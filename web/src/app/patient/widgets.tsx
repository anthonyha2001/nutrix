"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Droplet, Minus, Plus } from "lucide-react";
import { FoodSearch } from "@/components/food-search";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import { Alert, Button, buttonClass, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { amountLabel, round, SLOT_LABELS, type FoodHit, type MealSlot, type SavedMeal } from "@/lib/nutrition";
import { addWater, logFood, logPlanMeal, recordWeight, requestAppointment, saveCheckin } from "./actions";

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) showToast(r.error, "error");
      else {
        if (r.success) showToast(r.success);
        after?.();
      }
    });
  return [pending, run] as const;
}

// ---------------------------------------------------------------- water

export function WaterCard({ date, ml, goal = 2000 }: { date: string; ml: number; goal?: number }) {
  const [pending, run] = useRun();
  const glasses = Math.round(ml / 250);
  const total = Math.max(8, Math.ceil(goal / 250));
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Water</p>
        <p className="text-sm text-muted tabular-nums">
          {round(ml / 1000, 2)} of {goal / 1000} L
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <Droplet key={i} className={`size-6 transition ${i < glasses ? "fill-sky-400 text-sky-500" : "text-line"}`} />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={pending || ml <= 0} onClick={() => run(() => addWater(date, -250))} aria-label="Remove a glass" className={buttonClass("secondary", "px-3")}>
          <Minus className="size-4" />
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => addWater(date, 250))} className={buttonClass("primary", "flex-1")}>
          <Plus className="size-4" /> Glass (250 ml)
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => addWater(date, 500))} className={buttonClass("secondary")}>
          +500 ml
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- check-in

type Checkin = { mood: number | null; energy: number | null; hunger: number | null; sleep_hours: number | null; followed_plan: number | null; note: string | null } | null;

function Scale({ name, label, low, high, value }: { name: string; label: string; low: string; high: string; value: number | null }) {
  const [v, setV] = useState(value ?? 0);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <input type="hidden" name={name} value={v || ""} />
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setV(n)} aria-pressed={v === n} className={`h-11 rounded-xl border text-sm font-semibold transition ${v === n ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink/30"}`}>
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function CheckinCard({ date, checkin }: { date: string; checkin: (NonNullable<Checkin> & { checked_in?: boolean }) | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await saveCheckin(date, prev, fd);
    if (r.success) {
      showToast(r.success);
      setOpen(false);
    }
    return r;
  }, {});
  const done = Boolean(checkin?.checked_in);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-left transition hover:border-ink/20">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${done ? "bg-brand" : "bg-canvas"}`}>
          {done ? <Check className="size-5" /> : <Plus className="size-5 text-muted" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Daily check-in</span>
          <span className="block text-sm text-muted">{done ? "Done for today. Tap to change." : "How are you today? 20 seconds."}</span>
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Daily check-in" sheet>
        <form action={action} className="space-y-5">
          {state.error && <Alert tone="error">{state.error}</Alert>}
          <Scale name="mood" label="Mood" low="Very low" high="Great" value={checkin?.mood ?? null} />
          <Scale name="energy" label="Energy" low="Exhausted" high="Full of energy" value={checkin?.energy ?? null} />
          <Scale name="hunger" label="Hunger" low="Not hungry" high="Very hungry" value={checkin?.hunger ?? null} />
          <Scale name="followed_plan" label="Did you follow your plan?" low="Not at all" high="Completely" value={checkin?.followed_plan ?? null} />
          <Field label="Hours of sleep" optional>
            <input name="sleep_hours" inputMode="decimal" defaultValue={checkin?.sleep_hours ?? ""} className={inputClass} />
          </Field>
          <Field label="Anything to tell your dietitian?" optional>
            <input name="note" maxLength={500} defaultValue={checkin?.note ?? ""} className={inputClass} />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save check-in"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- log a planned meal

export function LogMealButton({ date, meal, logged }: { date: string; meal: SavedMeal; logged: boolean }) {
  const [open, setOpen] = useState(false);
  // For each planned food: -1 = skipped, 0 = as planned, n = swap n.
  const [choice, setChoice] = useState<number[]>(() => meal.items.map(() => 0));
  const [pending, run] = useRun();

  function submit() {
    const items = meal.items.flatMap((it, i) => {
      const c = choice[i];
      if (c < 0) return [];
      const pick = c === 0 ? it : it.alternatives![c - 1];
      return [{ foodId: pick.food_id, grams: Number(pick.grams), serving: pick.serving ?? null, swap: c > 0 }];
    });
    run(() => logPlanMeal(date, meal.slot, meal.key, items), () => setOpen(false));
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(logged ? "ghost" : "secondary", "h-9 text-xs")}>
        {logged ? (
          <>
            <Check className="size-4 text-success" /> Logged
          </>
        ) : (
          "I ate this"
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${meal.name || SLOT_LABELS[meal.slot]}: what did you eat?`} sheet>
        <div className="space-y-4">
          <ul className="space-y-3">
            {meal.items.map((it, i) => {
              const options = [{ label: `${it.name} (${amountLabel(it)})`, v: 0 }, ...(it.alternatives ?? []).map((a, j) => ({ label: `${a.name} (${amountLabel(a)})`, v: j + 1 })), { label: "Didn't eat it", v: -1 }];
              return (
                <li key={`${it.food_id}-${i}`} className="rounded-xl border border-line p-3">
                  {options.map((o) => (
                    <label key={o.v} className="flex cursor-pointer items-start gap-2.5 py-1.5 text-sm">
                      <input type="radio" name={`item-${i}`} checked={choice[i] === o.v} onChange={() => setChoice(choice.map((c, k) => (k === i ? o.v : c)))} className="mt-0.5 accent-ink" />
                      <span className={o.v === -1 ? "text-muted" : o.v > 0 ? "" : "font-medium"}>
                        {o.v > 0 && <span className="text-xs text-brand-strong">Swap: </span>}
                        {o.label}
                      </span>
                    </label>
                  ))}
                </li>
              );
            })}
          </ul>
          <Button type="button" onClick={submit} disabled={pending || choice.every((c) => c < 0)} className="w-full">
            {pending ? "Logging…" : "Log meal"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- add any food to the diary

export function DiaryAdd({ date, defaultSlot }: { date: string; defaultSlot: MealSlot }) {
  const [food, setFood] = useState<FoodHit | null>(null);
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [unit, setUnit] = useState("g");
  const [qty, setQty] = useState("100");
  const [pending, run] = useRun();

  const serving = food?.servings.find((s) => s.label === unit);
  const grams = serving ? Number(qty) * serving.grams : Number(qty);
  const kcal = food && grams > 0 ? (food.kcal * grams) / 100 : 0;

  function pick(f: FoodHit) {
    setFood(f);
    const s = f.servings.find((x) => x.label === "1 portion") ?? f.servings[0];
    setUnit(s ? s.label : "g");
    setQty(s ? "1" : "100");
  }

  if (!food) return <FoodSearch onPick={pick} placeholder="Search a food to log" />;
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{food.name}</p>
        <button type="button" onClick={() => setFood(null)} className="text-sm text-muted hover:text-ink">
          Change
        </button>
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(",", "."))} aria-label="Amount" className={`${inputClass} w-24`} />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" className={`${inputClass} flex-1`}>
          <option value="g">grams</option>
          {food.servings.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label} ({round(s.grams)} g)
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
          <button key={s} type="button" onClick={() => setSlot(s)} className={`h-9 rounded-lg text-xs font-medium ${slot === s ? "bg-ink text-white" : "bg-canvas text-ink/80"}`}>
            {SLOT_LABELS[s]}
          </button>
        ))}
      </div>
      <Button
        type="button"
        disabled={pending || !(grams > 0)}
        className="w-full"
        onClick={() =>
          run(
            () => logFood({ date, slot, foodId: food.id, grams, serving: serving ? { label: serving.label, qty: Number(qty), unit_g: serving.grams } : null }),
            () => setFood(null),
          )
        }
      >
        {pending ? "Adding…" : `Add · ${round(kcal)} kcal`}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- weight and appointment requests

export function WeightForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await recordWeight(prev, fd);
    if (r.success) showToast(r.success);
    return r;
  }, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input name="weight_kg" inputMode="decimal" required placeholder="Weight" aria-label="Weight in kg" className={`${inputClass} pr-10`} />
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted">kg</span>
        </div>
        <input name="measured_on" type="date" defaultValue={today} max={today} aria-label="Date" className={`${inputClass} w-40`} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save weight"}
      </Button>
    </form>
  );
}

export function RequestForm({ tomorrow }: { tomorrow: string }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await requestAppointment(prev, fd);
    if (r.success) showToast(r.success);
    return r;
  }, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Day">
          <input name="date" type="date" required min={tomorrow} defaultValue={tomorrow} className={inputClass} />
        </Field>
        <Field label="Time">
          <input name="time" type="time" required step={900} defaultValue="17:00" className={inputClass} />
        </Field>
      </div>
      <Field label="Note" optional>
        <input name="note" maxLength={500} placeholder="e.g. Evenings are better for me" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Request appointment"}
      </Button>
    </form>
  );
}
