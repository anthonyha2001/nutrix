"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Check, GripVertical, Star, X } from "lucide-react";
import { quickFindFoods } from "@/app/food-actions";
import { Button } from "@/components/ui";
import { quickAmount, splitQuickText, type QuickLine } from "@/lib/quick-add";
import { dayMacros, round, SLOT_LABELS, type FoodHit, type PlanDay, type PlanItem } from "@/lib/nutrition";

// ---- Drag and drop payloads -------------------------------------------------

export const DRAG_FOOD = "application/x-nutrix-food";
export const DRAG_ITEM = "application/x-nutrix-item";
export type ItemRef = { day: number; meal: string; index: number };

export function readDrop(e: React.DragEvent): { food?: FoodHit; item?: ItemRef; copy: boolean } | null {
  const copy = e.ctrlKey || e.metaKey || e.altKey;
  const f = e.dataTransfer.getData(DRAG_FOOD);
  if (f) return { food: JSON.parse(f) as FoodHit, copy };
  const i = e.dataTransfer.getData(DRAG_ITEM);
  if (i) return { item: JSON.parse(i) as ItemRef, copy };
  return null;
}

export const canDrop = (e: React.DragEvent) => e.dataTransfer.types.includes(DRAG_FOOD) || e.dataTransfer.types.includes(DRAG_ITEM);

// A plan item back as a food (for favourites and drag), with its own numbers.
export function itemToFood(item: PlanItem): FoodHit {
  return {
    id: item.food_id,
    name: item.name,
    category: "",
    brand: null,
    is_recipe: false,
    source: "usda",
    kcal: item.per100.kcal,
    protein_g: item.per100.protein_g,
    carbs_g: item.per100.carbs_g,
    fat_g: item.per100.fat_g,
    fiber_g: item.per100.fiber_g,
    allergens: item.allergens,
    servings: item.units ?? (item.serving ? [{ label: item.serving.label, grams: item.serving.unit_g }] : []),
  };
}

// ---- Favourites and recent foods (kept in this browser) ---------------------

const KEY = "nutrix:food-shelf";
type Shelf = { favorites: FoodHit[]; recent: FoodHit[] };
const EMPTY: Shelf = { favorites: [], recent: [] };
let cache: { raw: string | null; value: Shelf } = { raw: null, value: EMPTY };

function readShelf(): Shelf {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cache.raw) cache = { raw, value: raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY };
    return cache.value;
  } catch {
    return EMPTY;
  }
}
function writeShelf(next: Shelf) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("nutrix-shelf"));
  } catch {}
}
const subscribe = (cb: () => void) => {
  window.addEventListener("nutrix-shelf", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("nutrix-shelf", cb);
    window.removeEventListener("storage", cb);
  };
};

export function useShelf() {
  return useSyncExternalStore(subscribe, readShelf, () => EMPTY);
}

export function rememberFood(food: FoodHit) {
  const s = readShelf();
  writeShelf({ ...s, recent: [food, ...s.recent.filter((f) => f.id !== food.id)].slice(0, 16) });
}

export function toggleFavorite(food: FoodHit) {
  const s = readShelf();
  const on = s.favorites.some((f) => f.id === food.id);
  writeShelf({ ...s, favorites: on ? s.favorites.filter((f) => f.id !== food.id) : [food, ...s.favorites].slice(0, 40) });
}

export function FavoriteButton({ food }: { food: FoodHit }) {
  const shelf = useShelf();
  const on = shelf.favorites.some((f) => f.id === food.id);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(food)}
      aria-label={on ? `Remove ${food.name} from favourites` : `Add ${food.name} to favourites`}
      title={on ? "In your favourites" : "Add to favourites"}
      className={`grid size-8 place-items-center rounded-lg hover:bg-canvas ${on ? "text-amber-500" : "text-muted hover:text-ink"}`}
    >
      <Star className={`size-4 ${on ? "fill-current" : ""}`} />
    </button>
  );
}

// Chips of favourite and recent foods: click adds to the selected meal, or drag onto any meal.
export function FoodShelf({ onAdd, target }: { onAdd: (food: FoodHit) => void; target: string }) {
  const shelf = useShelf();
  const recent = shelf.recent.filter((r) => !shelf.favorites.some((f) => f.id === r.id)).slice(0, 10);
  if (!shelf.favorites.length && !recent.length) {
    return <p className="text-xs text-muted">Foods you add appear here for one-click reuse. Star a food to keep it in your favourites.</p>;
  }
  const chip = (f: FoodHit, fav: boolean) => (
    <button
      key={f.id}
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_FOOD, JSON.stringify(f));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(f)}
      title={`Add to ${target}, or drag onto a meal`}
      className="inline-flex h-8 max-w-56 cursor-grab items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium hover:border-ink/30 active:cursor-grabbing"
    >
      {fav && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}
      <span className="truncate">{f.name}</span>
    </button>
  );
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">
        Click to add to <span className="font-medium text-ink">{target}</span>, or drag onto any meal.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {shelf.favorites.map((f) => chip(f, true))}
        {recent.map((f) => chip(f, false))}
      </div>
    </div>
  );
}

// ---- Quick typing -----------------------------------------------------------

type Draft = { line: QuickLine; options: FoodHit[]; pick: number; on: boolean };

export function QuickAdd({ onAdd, onDone }: { onAdd: (items: PlanItem[]) => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [pending, start] = useTransition();

  const find = () => {
    const lines = splitQuickText(text);
    if (!lines.length) return;
    start(async () => {
      const found = await quickFindFoods(lines.map((l) => l.name));
      setDrafts(lines.map((line, i) => ({ line, options: found[i] ?? [], pick: 0, on: (found[i] ?? []).length > 0 })));
    });
  };

  if (!drafts) {
    return (
      <div className="space-y-2">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) find();
          }}
          rows={2}
          placeholder="e.g. 2 eggs, 1 pita, labneh 30 g, 1 cup of rice, half a cucumber"
          aria-label="Type several foods"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={find} disabled={pending || !text.trim()}>
            {pending ? "Finding…" : "Find foods"}
          </Button>
          <button type="button" onClick={onDone} className="text-sm text-muted hover:text-ink">
            Back to search
          </button>
        </div>
      </div>
    );
  }

  const ready = drafts.filter((d) => d.on && d.options[d.pick]);
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {drafts.map((d, i) => {
          const food = d.options[d.pick];
          const amount = food ? quickAmount(food, d.line) : null;
          return (
            <li key={i} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${d.on ? "" : "bg-canvas/60"}`}>
              <input
                type="checkbox"
                checked={d.on && Boolean(food)}
                disabled={!food}
                onChange={(e) => setDrafts((all) => all!.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                aria-label="Add this food"
                className="accent-ink"
              />
              <span className="w-32 shrink-0 truncate text-xs text-muted" title={d.line.raw}>
                {d.line.raw}
              </span>
              {food ? (
                <>
                  <select
                    value={d.pick}
                    onChange={(e) => setDrafts((all) => all!.map((x, j) => (j === i ? { ...x, pick: Number(e.target.value) } : x)))}
                    aria-label="Food"
                    className="h-8 min-w-0 flex-1 truncate rounded-lg border border-line bg-surface px-2 text-sm"
                  >
                    {d.options.map((o, k) => (
                      <option key={o.id} value={k}>
                        {o.name}
                        {o.brand ? ` (${o.brand})` : ""}
                      </option>
                    ))}
                  </select>
                  <span className={`text-xs tabular-nums ${amount?.sure ? "text-muted" : "text-amber-800"}`} title={amount?.note ?? undefined}>
                    {amount?.item.serving ? `${round(amount.item.serving.qty, 2)} x ${amount.item.serving.label.replace(/^1\s+/, "")}` : `${round(amount?.item.grams ?? 0)} g`}
                    {amount?.note ? " (check)" : ""}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-xs text-danger">No food found: search it instead.</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!ready.length}
          onClick={() => {
            const items = ready.map((d) => {
              const food = d.options[d.pick];
              rememberFood(food);
              return quickAmount(food, d.line).item;
            });
            onAdd(items);
            setDrafts(null);
            setText("");
          }}
        >
          <Check className="size-4" /> Add {ready.length} food{ready.length === 1 ? "" : "s"}
        </Button>
        <button type="button" onClick={() => setDrafts(null)} className="text-sm text-muted hover:text-ink">
          Edit the text
        </button>
        <span className="text-xs text-muted">Amounts marked (check) were assumed: adjust them after adding.</span>
      </div>
    </div>
  );
}

// ---- Week view: every day side by side, drag foods and meals around ---------

export function WeekGrid({
  days,
  onOpenDay,
  onDropOnMeal,
  onCopyMeal,
  onRemoveItem,
}: {
  days: PlanDay[];
  onOpenDay: (day: number) => void;
  onDropOnMeal: (e: React.DragEvent, day: number, meal: string) => void;
  onCopyMeal: (fromDay: number, meal: string, toDay: number) => void;
  onRemoveItem: (ref: ItemRef) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Drag a food to another meal or day to move it (hold Ctrl to copy). Drag a meal&apos;s name onto another day to copy the whole meal. Click a day to edit amounts.
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(13rem, 1fr))` }}>
          {days.map((d, di) => (
            <div
              key={di}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-nutrix-meal")) {
                  e.preventDefault();
                  setOver(`day${di}`);
                }
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                const raw = e.dataTransfer.getData("application/x-nutrix-meal");
                setOver(null);
                if (!raw) return;
                e.preventDefault();
                const m = JSON.parse(raw) as { day: number; meal: string };
                if (m.day !== di) onCopyMeal(m.day, m.meal, di);
              }}
              className={`space-y-2 rounded-xl border p-2 ${over === `day${di}` ? "border-ink bg-ink/5" : "border-line bg-canvas/50"}`}
            >
              <button type="button" onClick={() => onOpenDay(di)} className="flex w-full items-baseline justify-between gap-2 px-1 text-left">
                <span className="text-sm font-semibold hover:underline">{d.label}</span>
                <span className="text-xs text-muted tabular-nums">{round(dayMacros(d).kcal)} kcal</span>
              </button>
              {d.meals.map((m) => {
                const id = `${di}:${m.key}`;
                return (
                  <div
                    key={m.key}
                    onDragOver={(e) => {
                      if (canDrop(e)) {
                        e.preventDefault();
                        e.stopPropagation();
                        setOver(id);
                      }
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(e) => {
                      setOver(null);
                      e.stopPropagation();
                      onDropOnMeal(e, di, m.key);
                    }}
                    className={`rounded-lg border bg-surface ${over === id ? "border-ink" : "border-line"}`}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-nutrix-meal", JSON.stringify({ day: di, meal: m.key }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className="flex cursor-grab items-center gap-1 border-b border-line px-2 py-1.5 text-xs font-semibold active:cursor-grabbing"
                      title="Drag onto another day to copy this meal"
                    >
                      <GripVertical className="size-3 text-muted" />
                      {m.name || SLOT_LABELS[m.slot]}
                    </div>
                    <ul className="min-h-8 p-1">
                      {m.items.map((it, ii) => (
                        <li
                          key={it.uid ?? ii}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_ITEM, JSON.stringify({ day: di, meal: m.key, index: ii } satisfies ItemRef));
                            e.dataTransfer.effectAllowed = "copyMove";
                          }}
                          className="group flex cursor-grab items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-canvas active:cursor-grabbing"
                        >
                          <span className="min-w-0 flex-1 truncate" title={it.name}>
                            {it.name}
                          </span>
                          <span className="shrink-0 text-muted tabular-nums">{round(it.grams)} g</span>
                          <button type="button" onClick={() => onRemoveItem({ day: di, meal: m.key, index: ii })} aria-label={`Remove ${it.name}`} className="hidden text-muted hover:text-danger group-hover:block">
                            <X className="size-3" />
                          </button>
                        </li>
                      ))}
                      {!m.items.length && <li className="px-1.5 py-1 text-xs text-muted">Drop foods here</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

