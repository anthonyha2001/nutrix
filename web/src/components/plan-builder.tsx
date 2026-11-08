"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, GripVertical, Repeat, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { GOALS, guessGoal, missingForTargets, suggestTargets, type Goal, type TargetProfile } from "@/lib/energy";
import { useConfirm } from "@/components/confirm";
import { planChecks } from "@/lib/plan-checks";
import { suggestSwaps, type SwapSuggestion } from "@/app/food-actions";
import { canDrop, DRAG_ITEM, FavoriteButton, FoodShelf, itemToFood, QuickAdd, readDrop, rememberFood, WeekGrid, type ItemRef } from "@/components/plan-builder-tools";
import { FoodSearch } from "@/components/food-search";
import { MacroSummary } from "@/components/macro-summary";
import { showToast } from "@/components/toaster";
import { Alert, Button, Field, inputClass, inputWidth } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import {
  ALLERGEN_LABELS,
  WEEKDAYS,
  amountLabel,
  dayMacros,
  daysToContent,
  defaultItem,
  foodToItem,
  itemMacros,
  mealMacros,
  round,
  SLOT_LABELS,
  sumMacros,
  type MealSlot,
  type PlanDay,
  type PlanItem,
  type PlanMeal,
  type Targets,
} from "@/lib/nutrition";

export type TemplateKind = "meal" | "day" | "week" | "program";

export type BuilderMeta = {
  name: string;
  category?: string;
  description?: string;
  startsOn?: string;
  endsOn?: string;
  notes?: string;
  targets?: Targets;
};

export type BuilderSave = (
  input: BuilderMeta & { content: ReturnType<typeof daysToContent> },
  options?: { give?: boolean },
) => Promise<ActionState>;

// Shown on drafts and new plans: save and hand the plan to the patient in one
// step, instead of saving a draft and activating it from the list.
export type GiveToPatient = { label: string; replaces?: string | null };

// Read only from event handlers (undo grouping), never during render.
const clock = () => Date.now();

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const SLOTS: MealSlot[] = ["breakfast", "snack", "lunch", "snack", "dinner"];

export function blankDays(kind: TemplateKind | "plan"): PlanDay[] {
  const day = (label: string): PlanDay => ({
    label,
    meals: kind === "meal" ? [{ key: newKey(), slot: "lunch", items: [] }] : (["breakfast", "lunch", "dinner"] as MealSlot[]).map((slot) => ({ key: newKey(), slot, items: [] })),
  });
  if (kind === "week") return WEEKDAYS.map(day);
  return [day(kind === "plan" ? "Every day" : "Day 1")];
}

// Builds meal plans and templates. Everything is edited locally; one Save
// sends food ids and grams, and the database writes the numbers.
export function PlanBuilder({
  mode,
  kind = "day",
  initialMeta,
  initialDays,
  patientAllergies = [],
  onSave,
  closeParams,
  readOnly = false,
  give,
  profile,
  draftKey,
}: {
  mode: "plan" | "template";
  kind?: TemplateKind;
  initialMeta: BuilderMeta;
  initialDays: PlanDay[];
  patientAllergies?: string[];
  onSave: BuilderSave;
  closeParams: string[];
  readOnly?: boolean;
  give?: GiveToPatient;
  // The patient's numbers, for suggested targets (plans only).
  profile?: TargetProfile;
  // Where unsaved work is kept in this browser (e.g. "plan:<patient>:<plan or new>").
  draftKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [meta, setMeta] = useState<BuilderMeta>(initialMeta);
  const nameRef = useRef<HTMLInputElement>(null);
  const [days, setDaysState] = useState<PlanDay[]>(initialDays.length ? initialDays : blankDays(mode === "plan" ? "plan" : kind));
  // Undo: earlier versions of the days, newest last. Quick successive edits
  // (typing an amount) count as one step.
  const [past, setPast] = useState<PlanDay[][]>([]);
  const lastStep = useRef(0);
  // Bumped on undo or restore so inputs that keep their own text redraw.
  const [revision, setRevision] = useState(0);
  const setDays = (next: PlanDay[] | ((d: PlanDay[]) => PlanDay[])) => {
    const now = clock();
    if (now - lastStep.current > 800) setPast((p) => [...p.slice(-39), days]);
    lastStep.current = now;
    setDaysState(next);
  };
  const undo = () => {
    const prev = past.at(-1);
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setDaysState(prev);
    setRevision((r) => r + 1);
    lastStep.current = 0;
  };
  const draft = useLocalDraft(readOnly ? undefined : draftKey, { meta, days });
  const [dayIndex, setDayIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDialog, confirm] = useConfirm();

  const day = days[Math.min(dayIndex, days.length - 1)];
  const singleDay = mode === "template" && (kind === "meal" || kind === "day");
  const maxDays = kind === "week" && mode === "template" ? 7 : 84;
  const allTotals = sumMacros(days.map(dayMacros));
  const average = { ...allTotals, kcal: allTotals.kcal / days.length, protein_g: allTotals.protein_g / days.length, carbs_g: allTotals.carbs_g / days.length, fat_g: allTotals.fat_g / days.length, fiber_g: allTotals.fiber_g / days.length };

  const checks = mode === "plan" && !readOnly ? planChecks(days, meta.targets, patientAllergies, give?.label.replace(/^Give to /, "")) : [];
  const [checksOpen, setChecksOpen] = useState(true);
  // Week view: all days side by side, with drag and drop between meals and days.
  const [view, setView] = useState<"day" | "week">("day");
  // The meal that one-click favourites go to (the last one worked on).
  const [targetKey, setTargetKey] = useState<string | null>(null);

  const updateDay = (fn: (d: PlanDay) => PlanDay) => setDays((all) => all.map((d, i) => (i === dayIndex ? fn(d) : d)));
  const updateMeal = (key: string, fn: (m: PlanMeal) => PlanMeal) => updateDay((d) => ({ ...d, meals: d.meals.map((m) => (m.key === key ? fn(m) : m)) }));

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    for (const p of closeParams) next.delete(p);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function save(options?: { give?: boolean }) {
    setError(null);
    // A template with no name takes its first meal's name.
    const name = meta.name.trim() || (mode === "template" ? (days.flatMap((d) => d.meals).find((m) => m.name?.trim())?.name?.trim() ?? "") : "");
    if (!name) {
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      nameRef.current?.focus();
      return setError(mode === "plan" ? "Give the plan a name (top of this window)." : "Give the template a name (top of this window).");
    }
    if (name !== meta.name) setMeta({ ...meta, name });
    if (days.every((d) => d.meals.every((m) => m.items.length === 0))) return setError("Add at least one food.");
    if (options?.give) {
      const warnings = checks.filter((c) => c.level === "warning");
      const lines = [
        warnings.length ? `${warnings.length} thing${warnings.length > 1 ? "s" : ""} to check: ${warnings.map((w) => w.text).join(" ")}` : null,
        give?.replaces ? `"${give.replaces}" moves to previous plans.` : null,
      ].filter(Boolean);
      if (lines.length && !(await confirm(lines.join("\n\n"), { confirmLabel: warnings.length ? `${give?.label} anyway` : give?.label }))) return;
    }
    startTransition(async () => {
      const result = await onSave({ ...meta, name, content: daysToContent(days) }, options);
      if (result.error) setError(result.error);
      else {
        draft.clear();
        showToast(result.success ?? "Saved");
        close();
      }
    });
  }

  async function removeDay(i: number) {
    if (days[i].meals.some((m) => m.items.length) && !(await confirm(`Remove ${days[i].label} and its meals?`, { confirmLabel: "Remove day" }))) return;
    setDays((all) => all.filter((_, j) => j !== i));
    setDayIndex((x) => Math.max(0, Math.min(x, days.length - 2)));
  }

  function addDay(copyFrom?: PlanDay) {
    const label = kind === "week" && days.length < 7 ? WEEKDAYS[days.length] : `Day ${days.length + 1}`;
    const fresh = copyFrom
      ? { label, meals: copyFrom.meals.map((m) => ({ ...m, key: newKey(), items: m.items.map((it) => ({ ...it, uid: newKey() })) })) }
      : blankDays("day")[0];
    setDays((all) => [...all, { ...fresh, label }]);
    setDayIndex(days.length);
  }

  function addMeal() {
    const used = day.meals.length;
    updateDay((d) => ({ ...d, meals: [...d.meals, { key: newKey(), slot: SLOTS[Math.min(used, SLOTS.length - 1)] ?? "snack", items: [] }] }));
  }

  // Puts a copy of this meal in every other day: it replaces the meal of the
  // same kind and name there, or is added when the day has none.
  async function copyMealToAllDays(meal: PlanMeal) {
    const label = meal.name || SLOT_LABELS[meal.slot];
    if (!(await confirm(`Copy ${label} to the other ${days.length - 1} days? It replaces their ${label}.`, { confirmLabel: "Copy to all days" }))) return;
    const same = (m: PlanMeal) => m.slot === meal.slot && (m.name ?? "") === (meal.name ?? "");
    const copy = () => ({ ...meal, key: newKey(), items: meal.items.map((it) => ({ ...it, uid: newKey(), alternatives: it.alternatives?.map((a) => ({ ...a, uid: newKey() })) })) });
    setDays((all) =>
      all.map((d, i) => {
        if (i === dayIndex) return d;
        const at = d.meals.findIndex(same);
        return at >= 0 ? { ...d, meals: d.meals.map((m, j) => (j === at ? copy() : m)) } : { ...d, meals: [...d.meals, copy()] };
      }),
    );
    showToast(`${label} copied to all days`);
  }

  const freshItem = (it: PlanItem): PlanItem => ({ ...it, uid: newKey(), alternatives: it.alternatives?.map((a) => ({ ...a, uid: newKey() })) });

  function addItems(dayAt: number, mealKey: string, items: PlanItem[]) {
    setDays((all) => all.map((d, i) => (i === dayAt ? { ...d, meals: d.meals.map((m) => (m.key === mealKey ? { ...m, items: [...m.items, ...items] } : m)) } : d)));
  }

  // Move a food to another meal or day (or copy it, holding Ctrl).
  function moveItem(from: ItemRef, toDay: number, toMeal: string, copy: boolean) {
    if (!copy && from.day === toDay && from.meal === toMeal) return;
    setDays((all) => {
      const item = all[from.day]?.meals.find((m) => m.key === from.meal)?.items[from.index];
      if (!item) return all;
      return all.map((d, di) => ({
        ...d,
        meals: d.meals.map((m) => {
          let items = m.items;
          if (!copy && di === from.day && m.key === from.meal) items = items.filter((_, j) => j !== from.index);
          if (di === toDay && m.key === toMeal) items = [...items, copy ? freshItem(item) : item];
          return items === m.items ? m : { ...m, items };
        }),
      }));
    });
  }

  function removeItemAt(ref: ItemRef) {
    setDays((all) => all.map((d, di) => (di !== ref.day ? d : { ...d, meals: d.meals.map((m) => (m.key === ref.meal ? { ...m, items: m.items.filter((_, j) => j !== ref.index) } : m)) })));
  }

  // A whole meal dragged onto another day: added there as a copy.
  function copyMealToDay(fromDay: number, mealKey: string, toDay: number) {
    const meal = days[fromDay]?.meals.find((m) => m.key === mealKey);
    if (!meal) return;
    setDays((all) => all.map((d, di) => (di === toDay ? { ...d, meals: [...d.meals, { ...meal, key: newKey(), items: meal.items.map(freshItem) }] } : d)));
    showToast(`${meal.name || SLOT_LABELS[meal.slot]} copied to ${days[toDay].label}`);
  }

  function dropOnMeal(e: React.DragEvent, dayAt: number, mealKey: string) {
    const d = readDrop(e);
    if (!d) return;
    e.preventDefault();
    if (d.food) {
      rememberFood(d.food);
      addItems(dayAt, mealKey, [defaultItem(d.food)]);
    } else if (d.item) moveItem(d.item, dayAt, mealKey, d.copy);
    setTargetKey(mealKey);
  }

  const target = day.meals.find((m) => m.key === targetKey) ?? day.meals[0];

  function moveMeal(key: string, dir: -1 | 1) {
    updateDay((d) => {
      const i = d.meals.findIndex((m) => m.key === key);
      const j = i + dir;
      if (j < 0 || j >= d.meals.length) return d;
      const meals = [...d.meals];
      [meals[i], meals[j]] = [meals[j], meals[i]];
      return { ...d, meals };
    });
  }

  return (
    <div
      className="space-y-5"
      onKeyDown={(e) => {
        // Ctrl+Z outside text fields (they keep their own undo).
        const field = (e.target as HTMLElement).closest("input, textarea, select");
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !field && past.length) {
          e.preventDefault();
          undo();
        }
      }}
    >
      {draft.saved && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <span className="flex-1">You have unsaved changes from {draft.saved.at}. Restore them?</span>
          <Button
            type="button"
            onClick={() => {
              const saved = draft.restore();
              if (!saved) return;
              setMeta(saved.meta);
              setPast((p) => [...p.slice(-39), days]);
              setDaysState(saved.days);
              setRevision((r) => r + 1);
            }}
          >
            Restore
          </Button>
          <Button type="button" variant="ghost" onClick={() => draft.discard()}>
            Discard
          </Button>
        </div>
      )}
      {!readOnly && past.length > 0 && (
        <div className="-mb-3 flex justify-end">
          <button type="button" onClick={undo} title="Undo (Ctrl+Z)" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-canvas hover:text-ink">
            <Undo2 className="size-3.5" /> Undo
          </button>
        </div>
      )}
      {/* Details */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={mode === "plan" ? "Plan name" : "Template name"}>
          <input ref={nameRef} value={meta.name} disabled={readOnly} onChange={(e) => setMeta({ ...meta, name: e.target.value })} maxLength={120} className={inputClass} />
        </Field>
        {mode === "template" ? (
          <Field label="Category" optional>
            <input value={meta.category ?? ""} onChange={(e) => setMeta({ ...meta, category: e.target.value })} maxLength={60} placeholder="e.g. Weight loss, Diabetes, Ramadan" className={inputClass} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" optional>
              <input type="date" value={meta.startsOn ?? ""} disabled={readOnly} onChange={(e) => setMeta({ ...meta, startsOn: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Ends" optional>
              <input type="date" value={meta.endsOn ?? ""} disabled={readOnly} onChange={(e) => setMeta({ ...meta, endsOn: e.target.value })} className={inputClass} />
            </Field>
          </div>
        )}
      </div>

      {mode === "plan" && (
        <div className="rounded-xl border border-line p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Daily targets</p>
            {profile && !readOnly && <TargetSuggest profile={profile} onUse={(targets) => setMeta((m) => ({ ...m, targets }))} />}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["kcal", "Energy", "kcal"],
                ["protein_g", "Protein", "g"],
                ["carbs_g", "Carbs", "g"],
                ["fat_g", "Fat", "g"],
              ] as const
            ).map(([k, label, unit]) => (
              <label key={k} className="block space-y-1">
                <span className="text-xs text-muted">{label}</span>
                <span className="relative block">
                  <input
                    inputMode="numeric"
                    disabled={readOnly}
                    value={meta.targets?.[k] ?? ""}
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(/[^\d.]/g, ""));
                      setMeta({ ...meta, targets: { ...meta.targets, [k]: v > 0 ? v : undefined } });
                    }}
                    className={`${inputClass} pr-12`}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{unit}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Days */}
      {!singleDay && days.length > 1 && (
        <div className="flex gap-1" role="radiogroup" aria-label="View">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={`h-8 rounded-lg px-3 text-xs font-medium ${view === v ? "bg-ink text-white" : "bg-canvas text-ink/80 hover:text-ink"}`}
            >
              {v === "day" ? "Day view" : "Week view"}
            </button>
          ))}
        </div>
      )}

      {view === "week" && days.length > 1 && (
        <WeekGrid
          days={days}
          onOpenDay={(i) => {
            setDayIndex(i);
            setView("day");
          }}
          onDropOnMeal={dropOnMeal}
          onCopyMeal={copyMealToDay}
          onRemoveItem={removeItemAt}
        />
      )}

      {(view === "day" || days.length <= 1) && (
      <>
      {!singleDay && (
        <div className="flex flex-wrap items-center gap-1.5">
          {days.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDayIndex(i)}
              className={`h-9 rounded-lg px-3 text-sm transition ${i === dayIndex ? "bg-ink font-medium text-white" : "bg-canvas text-ink/80 hover:text-ink"}`}
            >
              {d.label}
            </button>
          ))}
          {!readOnly && days.length < maxDays && (
            <>
              <button type="button" onClick={() => addDay()} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-muted hover:bg-canvas hover:text-ink">
                <Plus className="size-4" /> Day
              </button>
              <button type="button" onClick={() => addDay(day)} title="Copy this day" className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-muted hover:bg-canvas hover:text-ink">
                <Copy className="size-4" /> Copy day
              </button>
            </>
          )}
        </div>
      )}

      {!singleDay && !readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Day name">
            <input value={day.label} maxLength={40} onChange={(e) => updateDay((d) => ({ ...d, label: e.target.value }))} className={inputWidth("w-48")} />
          </Field>
          {days.length > 1 && (
            <Button type="button" variant="ghost" onClick={() => removeDay(dayIndex)}>
              <Trash2 className="size-4" /> Remove day
            </Button>
          )}
        </div>
      )}

      {/* Day totals */}
      <div className="rounded-xl bg-canvas p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{singleDay ? "Total" : `${day.label} total`}</p>
        <MacroSummary totals={dayMacros(day)} targets={mode === "plan" ? meta.targets : undefined} />
      </div>

      {/* One-click favourites and recent foods */}
      {!readOnly && target && <FoodShelf target={target.name || SLOT_LABELS[target.slot]} onAdd={(food) => { rememberFood(food); addItems(dayIndex, target.key, [defaultItem(food)]); }} />}

      {/* Meals */}
      <div className="space-y-3" key={revision}>
        {day.meals.map((meal, mi) => (
          <MealCard
            key={meal.key}
            meal={meal}
            dayIndex={dayIndex}
            selected={!readOnly && target?.key === meal.key}
            onSelect={() => setTargetKey(meal.key)}
            onDropHere={(e) => dropOnMeal(e, dayIndex, meal.key)}
            first={mi === 0}
            last={mi === day.meals.length - 1}
            canRemove={kind !== "meal" || mode === "plan"}
            readOnly={readOnly}
            patientAllergies={patientAllergies}
            onChange={(fn) => updateMeal(meal.key, fn)}
            onMove={(dir) => moveMeal(meal.key, dir)}
            onCopyToAll={days.length > 1 && meal.items.length > 0 ? () => copyMealToAllDays(meal) : undefined}
            onRemove={async () => {
              if (meal.items.length && !(await confirm(`Remove ${meal.name || SLOT_LABELS[meal.slot]} and its foods?`, { confirmLabel: "Remove meal" }))) return;
              updateDay((d) => ({ ...d, meals: d.meals.filter((m) => m.key !== meal.key) }));
            }}
          />
        ))}
        {!readOnly && !(mode === "template" && kind === "meal") && day.meals.length < 12 && (
          <button
            type="button"
            onClick={addMeal}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-medium text-muted transition hover:border-ink/30 hover:text-ink"
          >
            <Plus className="size-4" /> Add meal
          </button>
        )}
      </div>
      </>
      )}

      {mode === "plan" && (
        <Field label="Notes for the patient" optional>
          <textarea
            value={meta.notes ?? ""}
            disabled={readOnly}
            onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
            maxLength={3000}
            rows={3}
            placeholder="Drink 2 litres of water a day, swap white bread for whole wheat…"
            className={`${inputClass} h-auto py-2.5`}
          />
        </Field>
      )}

      {checks.length > 0 && (
        <div className={`rounded-xl border p-4 ${checks.some((c) => c.level === "warning") ? "border-amber-300 bg-amber-50" : "border-line bg-canvas"}`}>
          <button type="button" onClick={() => setChecksOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-sm font-medium" aria-expanded={checksOpen}>
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">
              {checks.length} thing{checks.length > 1 ? "s" : ""} to check before giving this plan
            </span>
            {checksOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {checksOpen && (
            <ul className="mt-2 space-y-1 pl-6 text-sm">
              {checks.map((c, i) => (
                <li key={i} className={c.level === "warning" ? "list-disc" : "list-disc text-muted"}>
                  {c.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="sticky -bottom-5 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <p className="text-sm text-muted tabular-nums">
          {days.length > 1 ? `Average day ${round(average.kcal)} kcal` : `${round(average.kcal)} kcal`}
          <span className="hidden sm:inline"> · numbers are computed from the food database when you save</span>
        </p>
        {!readOnly &&
          (give ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => save()} disabled={pending}>
                Save draft
              </Button>
              <Button type="button" onClick={() => save({ give: true })} disabled={pending}>
                {pending ? "Saving…" : give.label}
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={() => save()} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          ))}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {confirmDialog}
    </div>
  );
}

function MealCard({
  meal,
  dayIndex,
  selected,
  onSelect,
  onDropHere,
  first,
  last,
  canRemove,
  readOnly,
  patientAllergies,
  onChange,
  onMove,
  onRemove,
  onCopyToAll,
}: {
  meal: PlanMeal;
  first: boolean;
  last: boolean;
  canRemove: boolean;
  readOnly: boolean;
  patientAllergies: string[];
  onChange: (fn: (m: PlanMeal) => PlanMeal) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onCopyToAll?: () => void;
  dayIndex: number;
  selected: boolean;
  onSelect: () => void;
  onDropHere: (e: React.DragEvent) => void;
}) {
  const [adding, setAdding] = useState(meal.items.length === 0 && !readOnly);
  const [typing, setTyping] = useState(false);
  const [over, setOver] = useState(false);
  const totals = mealMacros(meal);
  const setItem = (i: number, fn: (it: PlanItem) => PlanItem) => onChange((m) => ({ ...m, items: m.items.map((it, j) => (j === i ? fn(it) : it)) }));

  return (
    <div
      onFocusCapture={onSelect}
      onPointerDown={onSelect}
      onDragOver={(e) => {
        if (!readOnly && canDrop(e)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        setOver(false);
        onDropHere(e);
      }}
      className={`rounded-xl border bg-surface transition-colors ${over ? "border-ink bg-ink/5" : selected ? "border-ink/40" : "border-line"}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <select
          value={meal.slot}
          disabled={readOnly}
          onChange={(e) => onChange((m) => ({ ...m, slot: e.target.value as MealSlot }))}
          aria-label="Meal"
          className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm font-semibold outline-none focus:border-ink"
        >
          {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
            <option key={s} value={s}>
              {SLOT_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          value={meal.name ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange((m) => ({ ...m, name: e.target.value }))}
          placeholder="Name (optional)"
          maxLength={60}
          aria-label="Meal name"
          className="h-9 min-w-0 flex-1 rounded-lg px-2.5 text-sm outline-none hover:bg-canvas focus:bg-canvas"
        />
        <input
          type="time"
          value={meal.time ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange((m) => ({ ...m, time: e.target.value }))}
          aria-label="Time"
          className="h-9 rounded-lg px-2 text-sm text-muted outline-none hover:bg-canvas focus:bg-canvas"
        />
        <span className="ml-auto text-sm font-medium tabular-nums">{round(totals.kcal)} kcal</span>
        {!readOnly && (
          <span className="flex items-center">
            {onCopyToAll && (
              <IconButton label="Copy to all days" onClick={onCopyToAll}>
                <Copy className="size-4" />
              </IconButton>
            )}
            <IconButton label="Move up" disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton label="Move down" disabled={last} onClick={() => onMove(1)}>
              <ArrowDown className="size-4" />
            </IconButton>
            {canRemove && (
              <IconButton label="Remove meal" onClick={onRemove} danger>
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </span>
        )}
      </div>

      <ul className="divide-y divide-line">
        {meal.items.map((item, i) => (
          <ItemRow
            key={item.uid ?? `${item.food_id}-${i}`}
            item={item}
            dragRef={readOnly ? undefined : { day: dayIndex, meal: meal.key, index: i }}
            readOnly={readOnly}
            patientAllergies={patientAllergies}
            onChange={(fn) => setItem(i, fn)}
            onRemove={() => onChange((m) => ({ ...m, items: m.items.filter((_, j) => j !== i) }))}
          />
        ))}
      </ul>

      {!readOnly && (
        <div className="px-4 py-3">
          {typing ? (
            <QuickAdd onAdd={(items) => onChange((m) => ({ ...m, items: [...m.items, ...items] }))} onDone={() => setTyping(false)} />
          ) : adding ? (
            <div className="space-y-2">
              <FoodSearch
                autoFocus={meal.items.length > 0}
                onPick={(f) => {
                  rememberFood(f);
                  onChange((m) => ({ ...m, items: [...m.items, defaultItem(f)] }));
                }}
              />
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setTyping(true)} className="text-sm font-medium text-brand-strong hover:underline">
                  Type a list instead
                </button>
                {meal.items.length > 0 && (
                  <button type="button" onClick={() => setAdding(false)} className="text-sm text-muted hover:text-ink">
                    Done adding
                  </button>
                )}
              </div>
            </div>
          ) : (
            <span className="flex flex-wrap gap-4">
              <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-ink">
                <Plus className="size-4" /> Add food
              </button>
              <button type="button" onClick={() => setTyping(true)} className="text-sm text-muted hover:text-ink">
                Type a list
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  dragRef,
  readOnly,
  patientAllergies,
  onChange,
  onRemove,
  isSwap = false,
}: {
  item: PlanItem;
  readOnly: boolean;
  patientAllergies: string[];
  onChange: (fn: (it: PlanItem) => PlanItem) => void;
  onRemove: () => void;
  isSwap?: boolean;
  // Set in day view: the row can be dragged to another meal.
  dragRef?: ItemRef;
}) {
  const [swapsOpen, setSwapsOpen] = useState(false);
  const m = itemMacros(item);
  const conflicts = item.allergens.filter((a) => patientAllergies.includes(a));
  const swaps = item.alternatives ?? [];
  const units = item.units ?? [];

  return (
    <li className={isSwap ? "py-2" : "px-4 py-3"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {dragRef && !isSwap && (
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_ITEM, JSON.stringify(dragRef));
              e.dataTransfer.effectAllowed = "copyMove";
            }}
            title="Drag to another meal (hold Ctrl to copy)"
            className="-ml-2 cursor-grab text-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-xs text-muted tabular-nums">
            {round(m.kcal)} kcal · P {round(m.protein_g, 1)} · C {round(m.carbs_g, 1)} · F {round(m.fat_g, 1)}
          </p>
          {conflicts.length > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              <AlertTriangle className="size-3.5" />
              Patient allergy: {conflicts.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ")}
            </p>
          )}
        </div>
        {readOnly ? (
          <span className="text-sm tabular-nums">{amountLabel(item)}</span>
        ) : (
          <AmountInput item={item} units={units} onChange={onChange} />
        )}
        {!readOnly && (
          <span className="flex items-center">
            {!isSwap && (
              <button
                type="button"
                onClick={() => setSwapsOpen((o) => !o)}
                className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium ${swaps.length ? "text-ink" : "text-muted"} hover:bg-canvas hover:text-ink`}
                aria-expanded={swapsOpen}
              >
                <Repeat className="size-3.5" />
                {swaps.length ? `${swaps.length} swap${swaps.length > 1 ? "s" : ""}` : "Swaps"}
                {swapsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </button>
            )}
            {!isSwap && <FavoriteButton food={itemToFood(item)} />}
            <IconButton label={`Remove ${item.name}`} onClick={onRemove} danger>
              <X className="size-4" />
            </IconButton>
          </span>
        )}
      </div>
      {readOnly && swaps.length > 0 && (
        <p className="mt-1 text-xs text-muted">Or: {swaps.map((s) => `${s.name} (${amountLabel(s)})`).join("; ")}</p>
      )}
      {swapsOpen && !isSwap && !readOnly && (
        <div className="mt-3 space-y-2 rounded-lg bg-canvas p-3">
          <p className="text-xs text-muted">Approved swaps the patient may choose instead of this food.</p>
          <ul className="divide-y divide-line">
            {swaps.map((s, i) => (
              <ItemRow
                key={s.uid ?? `${s.food_id}-${i}`}
                item={s}
                isSwap
                readOnly={false}
                patientAllergies={patientAllergies}
                onChange={(fn) => onChange((it) => ({ ...it, alternatives: swaps.map((x, j) => (j === i ? fn(x) : x)) }))}
                onRemove={() => onChange((it) => ({ ...it, alternatives: swaps.filter((_, j) => j !== i) }))}
              />
            ))}
          </ul>
          <SwapSuggestions
            item={item}
            avoid={patientAllergies}
            taken={[item.food_id, ...swaps.map((s) => s.food_id)]}
            canAdd={swaps.length < 10}
            onAdd={(s) => onChange((it) => ({ ...it, alternatives: [...swaps, s] }))}
            onReplace={(s) => onChange((it) => ({ ...s, alternatives: it.alternatives }))}
          />
          {swaps.length < 10 && (
            <FoodSearch placeholder="Or search a swap" onPick={(f) => onChange((it) => ({ ...it, alternatives: [...swaps, defaultItem(f)] }))} />
          )}
        </div>
      )}
    </li>
  );
}

// Targets computed from the patient's weight, height, age, sex and activity.
function TargetSuggest({ profile, onUse }: { profile: TargetProfile; onUse: (t: Targets) => void }) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<Goal>(guessGoal(profile.goalText));
  const missing = missingForTargets(profile);
  const s = suggestTargets(profile, goal);

  if (missing.length) {
    return <p className="text-xs text-muted">Add {profile.firstName}&apos;s {missing.join(", ")} to get suggested targets.</p>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-brand-strong hover:bg-canvas">
        <Sparkles className="size-3.5" /> Suggest from {profile.firstName}&apos;s data
      </button>
    );
  }
  return (
    <div className="w-full space-y-3 rounded-lg bg-canvas p-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Goal">
        {GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={goal === g.id}
            onClick={() => setGoal(g.id)}
            className={`h-8 rounded-lg px-3 text-xs font-medium ${goal === g.id ? "bg-ink text-white" : "bg-surface text-ink/80 hover:text-ink"}`}
          >
            {g.label}
          </button>
        ))}
      </div>
      {s && (
        <>
          <p className="text-sm font-medium tabular-nums">
            {s.targets.kcal.toLocaleString("en-US")} kcal · P {s.targets.protein_g} g · C {s.targets.carbs_g} g · F {s.targets.fat_g} g
          </p>
          <p className="text-xs text-muted">{s.explanation} A starting point: adjust to the patient.</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => { onUse(s.targets); setOpen(false); }}>
              Use these
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Ready-made alternatives at the same energy, loaded when the swaps panel opens.
function SwapSuggestions({
  item,
  avoid,
  taken,
  canAdd,
  onAdd,
  onReplace,
}: {
  item: PlanItem;
  avoid: string[];
  taken: string[];
  canAdd: boolean;
  onAdd: (s: PlanItem) => void;
  onReplace: (s: PlanItem) => void;
}) {
  const kcal = round(itemMacros(item).kcal);
  const [state, setState] = useState<{ key: string; list: SwapSuggestion[] } | null>(null);
  const key = `${item.food_id}|${kcal}`;
  const [pending, start] = useTransition();

  useEffect(() => {
    if (state?.key === key || kcal <= 0) return;
    start(async () => setState({ key, list: await suggestSwaps(item.food_id, kcal, avoid) }));
    // Reload only when the food or its energy changes.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = (state?.list ?? []).filter((s) => !taken.includes(s.food.id));
  if (pending && !state) return <p className="text-xs text-muted">Finding similar foods…</p>;
  if (!list.length) return null;
  const toItem = (s: SwapSuggestion) => ({ ...foodToItem(s.food, s.grams), serving: null });

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">Similar foods at about {kcal} kcal</p>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {list.map((s) => {
          const m = itemMacros({ grams: s.grams, per100: toItem(s).per100 });
          return (
            <li key={s.food.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-0 flex-1 basis-48">
                <span className="block text-sm">{s.food.name}</span>
                <span className="block text-xs text-muted tabular-nums">
                  {s.grams} g · {round(m.kcal)} kcal · P {round(m.protein_g, 1)} · C {round(m.carbs_g, 1)} · F {round(m.fat_g, 1)}
                </span>
              </span>
              <span className="flex gap-1">
                {canAdd && (
                  <button type="button" onClick={() => onAdd(toItem(s))} className="h-8 rounded-lg px-2.5 text-xs font-medium hover:bg-canvas">
                    Add as swap
                  </button>
                )}
                <button type="button" onClick={() => onReplace(toItem(s))} className="h-8 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-canvas hover:text-ink">
                  Replace
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Quantity + unit ("g" or one of the food's servings).
function AmountInput({ item, units, onChange }: { item: PlanItem; units: { label: string; grams: number }[]; onChange: (fn: (it: PlanItem) => PlanItem) => void }) {
  const unit = item.serving?.label ?? "g";
  const qty = item.serving ? item.serving.qty : item.grams;
  const [text, setText] = useState(String(round(qty, 2)));

  function setQty(raw: string) {
    setText(raw);
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    onChange((it) => (it.serving ? { ...it, serving: { ...it.serving, qty: n }, grams: n * it.serving.unit_g } : { ...it, grams: n }));
  }

  function setUnit(label: string) {
    if (label === "g") {
      setText(String(round(item.grams)));
      onChange((it) => ({ ...it, serving: null }));
      return;
    }
    const u = units.find((x) => x.label === label);
    if (!u) return;
    setText("1");
    onChange((it) => ({ ...it, serving: { label: u.label, qty: 1, unit_g: u.grams }, grams: u.grams }));
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => setQty(e.target.value)}
        aria-label={`Amount of ${item.name}`}
        className="h-9 w-16 rounded-lg border border-line bg-surface px-2 text-right text-sm tabular-nums outline-none focus:border-ink"
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        aria-label="Unit"
        className="h-9 max-w-40 truncate rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-ink"
      >
        <option value="g">g</option>
        {units.map((u) => (
          <option key={u.label} value={u.label}>
            {u.label} ({round(u.grams)} g)
          </option>
        ))}
      </select>
    </span>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-lg text-muted disabled:opacity-30 ${danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-canvas hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

// Keeps unsaved builder work in this browser (localStorage), so closing the
// builder by mistake loses nothing. Offered back the next time it opens; cleared
// on save. Never written to the database until the dietitian saves.
type Draft = { meta: BuilderMeta; days: PlanDay[] };
function useLocalDraft(key: string | undefined, current: Draft) {
  const storageKey = key ? `nutrix:draft:${key}` : null;
  const [saved, setSaved] = useState<(Draft & { at: string }) | null>(null);
  const baseline = useRef<string | null>(null);
  const offered = useRef(false);

  // On open: offer a stored draft that differs from what was loaded.
  useEffect(() => {
    if (!storageKey || offered.current) return;
    offered.current = true;
    baseline.current = JSON.stringify(current);
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const d = JSON.parse(raw) as Draft & { savedAt: number };
        if (JSON.stringify({ meta: d.meta, days: d.days }) === baseline.current) return localStorage.removeItem(storageKey);
        const at = new Date(d.savedAt);
        const sameDay = at.toDateString() === new Date().toDateString();
        setSaved({ meta: d.meta, days: d.days, at: at.toLocaleString("en-GB", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
      } catch {
        // Storage unavailable or unreadable: nothing to offer.
      }
    }, 0);
    return () => clearTimeout(t);
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // While editing: keep a copy once the work differs from what was loaded.
  const snapshot = JSON.stringify(current);
  useEffect(() => {
    if (!storageKey || saved || baseline.current === null) return;
    const t = setTimeout(() => {
      try {
        if (snapshot === baseline.current) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify({ ...JSON.parse(snapshot), savedAt: Date.now() }));
      } catch {
        // Full or blocked storage: the builder still works, just without recovery.
      }
    }, 600);
    return () => clearTimeout(t);
  }, [storageKey, snapshot, saved]);

  const remove = () => {
    try {
      if (storageKey) localStorage.removeItem(storageKey);
    } catch {}
  };
  return {
    saved,
    restore: () => {
      const s = saved;
      setSaved(null);
      return s;
    },
    discard: () => {
      remove();
      setSaved(null);
    },
    clear: remove,
  };
}
