"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Repeat, Trash2, X } from "lucide-react";
import { useConfirm } from "@/components/confirm";
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [meta, setMeta] = useState<BuilderMeta>(initialMeta);
  const [days, setDays] = useState<PlanDay[]>(initialDays.length ? initialDays : blankDays(mode === "plan" ? "plan" : kind));
  const [dayIndex, setDayIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDialog, confirm] = useConfirm();

  const day = days[Math.min(dayIndex, days.length - 1)];
  const singleDay = mode === "template" && (kind === "meal" || kind === "day");
  const maxDays = kind === "week" && mode === "template" ? 7 : 84;
  const allTotals = sumMacros(days.map(dayMacros));
  const average = { ...allTotals, kcal: allTotals.kcal / days.length, protein_g: allTotals.protein_g / days.length, carbs_g: allTotals.carbs_g / days.length, fat_g: allTotals.fat_g / days.length, fiber_g: allTotals.fiber_g / days.length };

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
    if (!meta.name.trim()) return setError("Give it a name.");
    if (days.every((d) => d.meals.every((m) => m.items.length === 0))) return setError("Add at least one food.");
    if (options?.give && give?.replaces && !(await confirm(`"${give.replaces}" moves to previous plans.`, { confirmLabel: give.label }))) return;
    startTransition(async () => {
      const result = await onSave({ ...meta, content: daysToContent(days) }, options);
      if (result.error) setError(result.error);
      else {
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
    <div className="space-y-5">
      {/* Details */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={mode === "plan" ? "Plan name" : "Template name"}>
          <input value={meta.name} disabled={readOnly} onChange={(e) => setMeta({ ...meta, name: e.target.value })} maxLength={120} className={inputClass} />
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
          <p className="mb-3 text-sm font-medium">Daily targets</p>
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

      {/* Meals */}
      <div className="space-y-3">
        {day.meals.map((meal, mi) => (
          <MealCard
            key={meal.key}
            meal={meal}
            first={mi === 0}
            last={mi === day.meals.length - 1}
            canRemove={kind !== "meal" || mode === "plan"}
            readOnly={readOnly}
            patientAllergies={patientAllergies}
            onChange={(fn) => updateMeal(meal.key, fn)}
            onMove={(dir) => moveMeal(meal.key, dir)}
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
  first,
  last,
  canRemove,
  readOnly,
  patientAllergies,
  onChange,
  onMove,
  onRemove,
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
}) {
  const [adding, setAdding] = useState(meal.items.length === 0 && !readOnly);
  const totals = mealMacros(meal);
  const setItem = (i: number, fn: (it: PlanItem) => PlanItem) => onChange((m) => ({ ...m, items: m.items.map((it, j) => (j === i ? fn(it) : it)) }));

  return (
    <div className="rounded-xl border border-line bg-surface">
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
            readOnly={readOnly}
            patientAllergies={patientAllergies}
            onChange={(fn) => setItem(i, fn)}
            onRemove={() => onChange((m) => ({ ...m, items: m.items.filter((_, j) => j !== i) }))}
          />
        ))}
      </ul>

      {!readOnly && (
        <div className="px-4 py-3">
          {adding ? (
            <div className="space-y-2">
              <FoodSearch autoFocus={meal.items.length > 0} onPick={(f) => onChange((m) => ({ ...m, items: [...m.items, defaultItem(f)] }))} />
              {meal.items.length > 0 && (
                <button type="button" onClick={() => setAdding(false)} className="text-sm text-muted hover:text-ink">
                  Done adding
                </button>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-ink">
              <Plus className="size-4" /> Add food
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
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
}) {
  const [swapsOpen, setSwapsOpen] = useState(false);
  const m = itemMacros(item);
  const conflicts = item.allergens.filter((a) => patientAllergies.includes(a));
  const swaps = item.alternatives ?? [];
  const units = item.units ?? [];

  return (
    <li className={isSwap ? "py-2" : "px-4 py-3"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
          {swaps.length < 10 && (
            <FoodSearch placeholder="Add a swap" onPick={(f) => onChange((it) => ({ ...it, alternatives: [...swaps, defaultItem(f)] }))} />
          )}
        </div>
      )}
    </li>
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
