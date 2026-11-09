"use client";

import { useActionState, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Check, Droplet, Minus, Plus } from "lucide-react";
import { FoodSearch } from "@/components/food-search";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import { Alert, Button, buttonClass, Field, inputClass, inputWidth } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { amountLabel, round, type FoodHit, type MealSlot, type SavedMeal } from "@/lib/nutrition";
import { amountIn } from "@/lib/plan-i18n";
import { LANGS, PATIENT_TEXT, type Lang } from "@/lib/patient-i18n";
import { addWater, deleteSubscription, logFood, logPlanMeal, recordWeight, requestAppointment, saveCheckin, saveSubscription, setLanguage } from "./actions";

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

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

// ---------------------------------------------------------------- water

export function WaterCard({ date, ml, goal = 2000, lang }: { date: string; ml: number; goal?: number; lang: Lang }) {
  const t = PATIENT_TEXT[lang].water;
  const [pending, run] = useRun();
  const glasses = Math.round(ml / 250);
  const total = Math.max(8, Math.ceil(goal / 250));
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{t.title}</p>
        <p className="text-sm text-muted tabular-nums">{t.amount(String(round(ml / 1000, 2)), String(goal / 1000))}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <Droplet key={i === glasses - 1 ? `last-${glasses}` : i} className={`size-6 transition-colors duration-300 ${i < glasses ? "fill-sky-400 text-sky-500" : "text-line"} ${i === glasses - 1 ? "drop-in" : ""}`} />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={pending || ml <= 0} onClick={() => run(() => addWater(date, -250))} aria-label={t.remove} className={buttonClass("secondary", "px-3")}>
          <Minus className="size-4" />
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => addWater(date, 250))} className={buttonClass("primary", "flex-1")}>
          <Plus className="size-4" /> {t.glass}
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => addWater(date, 500))} className={buttonClass("secondary")}>
          <bdi>{t.more}</bdi>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- check-in

type Checkin = { mood: number | null; energy: number | null; hunger: number | null; sleep_hours: number | null; followed_plan: number | null; note: string | null; checked_in?: boolean };

function Scale({ name, words, value }: { name: string; words: string[]; value: number | null }) {
  const [v, setV] = useState(value ?? 0);
  const [label, low, high] = words;
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

export function CheckinCard({ date, checkin, lang }: { date: string; checkin: Checkin | null; lang: Lang }) {
  const t = PATIENT_TEXT[lang].checkin;
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
      <button type="button" onClick={() => setOpen(true)} className="lift flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-start hover:border-ink/20">
        <span key={done ? "done" : "todo"} className={`grid size-10 shrink-0 place-items-center rounded-full ${done ? "check-pop bg-brand" : "bg-canvas"}`}>{done ? <Check className="size-5" /> : <Plus className="size-5 text-muted" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t.title}</span>
          <span className="block text-sm text-muted">{done ? t.done : t.prompt}</span>
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.title} sheet>
        <form action={action} className="space-y-5">
          {state.error && <Alert tone="error">{state.error}</Alert>}
          <Scale name="mood" words={t.mood} value={checkin?.mood ?? null} />
          <Scale name="energy" words={t.energy} value={checkin?.energy ?? null} />
          <Scale name="hunger" words={t.hunger} value={checkin?.hunger ?? null} />
          <Scale name="followed_plan" words={t.followed} value={checkin?.followed_plan ?? null} />
          <Field label={t.sleep}>
            <input name="sleep_hours" inputMode="decimal" defaultValue={checkin?.sleep_hours ?? ""} className={inputClass} />
          </Field>
          <Field label={t.note}>
            <input name="note" maxLength={500} defaultValue={checkin?.note ?? ""} className={inputClass} />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? t.saving : t.save}
          </Button>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- log a planned meal

export function LogMealButton({ date, meal, logged, lang }: { date: string; meal: SavedMeal; logged: boolean; lang: Lang }) {
  const t = PATIENT_TEXT[lang];
  const [open, setOpen] = useState(false);
  // For each planned food: -1 = skipped, 0 = as planned, n = swap n.
  const [choice, setChoice] = useState<number[]>(() => meal.items.map(() => 0));
  const [pending, run] = useRun();
  const amount = (i: { grams: number; serving?: { label: string; qty: number } | null }) => (lang === "en" ? amountLabel(i) : amountIn(i, lang));

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
            <Check className="check-pop size-4 rounded-full text-success" /> {t.log.logged}
          </>
        ) : (
          t.log.ate
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.log.sheetTitle(meal.name || t.slots[meal.slot])} sheet>
        <div className="space-y-4">
          <ul className="space-y-3">
            {meal.items.map((it, i) => {
              const options = [
                { name: it.name, amount: amount(it), v: 0 },
                ...(it.alternatives ?? []).map((a, j) => ({ name: a.name, amount: amount(a), v: j + 1 })),
                { name: t.log.skipped, amount: "", v: -1 },
              ];
              return (
                <li key={`${it.food_id}-${i}`} className="rounded-xl border border-line p-3">
                  {options.map((o) => (
                    <label key={o.v} className="flex cursor-pointer items-start gap-2.5 py-1.5 text-sm">
                      <input type="radio" name={`item-${i}`} checked={choice[i] === o.v} onChange={() => setChoice(choice.map((c, k) => (k === i ? o.v : c)))} className="mt-0.5 accent-ink" />
                      <span className={o.v === -1 ? "text-muted" : o.v > 0 ? "" : "font-medium"}>
                        {o.v > 0 && <span className="text-xs text-brand-strong">{t.log.swap} </span>}
                        <bdi>{o.name}</bdi>
                        {o.amount && <span className="text-muted"> ({o.amount})</span>}
                      </span>
                    </label>
                  ))}
                </li>
              );
            })}
          </ul>
          <Button type="button" onClick={submit} disabled={pending || choice.every((c) => c < 0)} className="w-full">
            {pending ? t.log.submitting : t.log.submit}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- add any food to the diary

export function DiaryAdd({ date, defaultSlot, lang }: { date: string; defaultSlot: MealSlot; lang: Lang }) {
  const t = PATIENT_TEXT[lang];
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

  if (!food) return <FoodSearch onPick={pick} placeholder={t.diary.search} lang={lang} allowOnline={false} />;
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          <bdi>{food.name}</bdi>
          {food.alt_name && (
            <bdi className="block text-xs font-normal text-muted" dir="ltr">
              {food.alt_name}
            </bdi>
          )}
        </p>
        <button type="button" onClick={() => setFood(null)} className="shrink-0 text-sm text-muted hover:text-ink">
          {t.diary.change}
        </button>
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(",", "."))} aria-label={t.diary.amount} className={inputWidth("w-24 shrink-0")} />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label={t.diary.unit} className={inputWidth("min-w-0 flex-1")}>
          <option value="g">{t.diary.grams}</option>
          {food.servings.map((s) => (
            <option key={s.label} value={s.label}>
              {lang === "en" ? s.label : amountIn({ grams: s.grams, serving: { label: s.label, qty: 1 } }, lang)} {lang === "en" ? `(${round(s.grams)} g)` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {SLOTS.map((s) => (
          <button key={s} type="button" onClick={() => setSlot(s)} className={`h-9 rounded-lg text-xs font-medium ${slot === s ? "bg-ink text-white" : "bg-canvas text-ink/80"}`}>
            {t.slots[s]}
          </button>
        ))}
      </div>
      <Button
        type="button"
        disabled={pending || !(grams > 0)}
        className="w-full"
        onClick={() => run(() => logFood({ date, slot, foodId: food.id, grams, serving: serving ? { label: serving.label, qty: Number(qty), unit_g: serving.grams } : null }), () => setFood(null))}
      >
        {pending ? t.diary.adding : t.diary.add(round(kcal))}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- weight and appointment requests

export function WeightForm({ today, lang }: { today: string; lang: Lang }) {
  const t = PATIENT_TEXT[lang].progress;
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await recordWeight(prev, fd);
    if (r.success) showToast(r.success);
    return r;
  }, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input name="weight_kg" inputMode="decimal" required placeholder={t.weight} aria-label={t.weightLabel} className={`${inputClass} pe-12`} />
          <span className="pointer-events-none absolute top-1/2 end-3.5 -translate-y-1/2 text-sm text-muted">{t.kg}</span>
        </div>
        <input name="measured_on" type="date" defaultValue={today} max={today} aria-label={t.date} className={inputWidth("w-40 shrink-0")} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}

export function RequestForm({ tomorrow, lang }: { tomorrow: string; lang: Lang }) {
  const t = PATIENT_TEXT[lang].appointments;
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await requestAppointment(prev, fd);
    if (r.success) showToast(r.success);
    return r;
  }, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t.day}>
          <input name="date" type="date" required min={tomorrow} defaultValue={tomorrow} className={inputClass} />
        </Field>
        <Field label={t.time}>
          <input name="time" type="time" required step={900} defaultValue="17:00" className={inputClass} />
        </Field>
      </div>
      <Field label={`${t.note} (${t.optional})`}>
        <input name="note" maxLength={500} placeholder={t.notePlaceholder} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- language

export function LanguageSwitch({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [pending, run] = useRun();
  return (
    <div className="grid grid-cols-2 gap-2">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          disabled={pending || l.id === lang}
          onClick={() => run(() => setLanguage(l.id), () => router.refresh())}
          aria-pressed={l.id === lang}
          className={`h-11 rounded-xl border text-sm font-semibold transition ${l.id === lang ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink/30"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- meal reminders

const urlB64ToUint8 = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type PushState = "unsupported" | "denied" | "off" | "on";

function readPushSupport(): "unsupported" | "denied" | "maybe" {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission === "denied" ? "denied" : "maybe";
}

export function RemindersCard({ lang, vapidKey }: { lang: Lang; vapidKey: string }) {
  const t = PATIENT_TEXT[lang].reminders;
  // What the browser supports never changes while the page is open.
  const support = useSyncExternalStore(
    () => () => {},
    readPushSupport,
    () => "maybe" as const,
  );
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (support !== "maybe") return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => setSubscribed(false));
  }, [support]);

  const state: PushState = support === "unsupported" || !vapidKey ? "unsupported" : support === "denied" ? "denied" : subscribed ? "on" : "off";

  function enable() {
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          showToast(t.denied, "error");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapidKey) }));
        const json = sub.toJSON();
        const r = await saveSubscription({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" });
        if (r.error) showToast(r.error, "error");
        else {
          setSubscribed(true);
          showToast(r.success ?? "");
        }
      } catch {
        showToast(PATIENT_TEXT[lang].errors.generic, "error");
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deleteSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      showToast(PATIENT_TEXT[lang].done.remindersOff);
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${state === "on" ? "bg-brand" : "bg-canvas"}`}>{state === "on" ? <Bell className="size-5" /> : <BellOff className="size-5 text-muted" />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t.title}</p>
          <p className="text-sm text-muted">{state === "on" ? t.on : state === "unsupported" ? t.unsupported : state === "denied" ? t.denied : t.body}</p>
        </div>
      </div>
      {(state === "off" || state === "on") && subscribed !== null && (
        <div className="mt-4">
          {state === "off" ? (
            <Button type="button" onClick={enable} disabled={pending} className="w-full">
              {pending ? t.working : t.enable}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={disable} disabled={pending} className="w-full">
              {pending ? t.working : t.disable}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- shopping list ticks

export type ShoppingGroup = { id: string; title: string; items: { key: string; name: string; alt?: string; amount: string }[] };

// Ticks are kept on this phone only (per plan), so the list works in the shop
// even with a weak connection.
export function ShoppingChecklist({ planId, groups, lang }: { planId: string; groups: ShoppingGroup[]; lang: Lang }) {
  const t = PATIENT_TEXT[lang].shopping;
  const storageKey = `nutrix-shopping-${planId}`;
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener("nutrix-shopping", onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener("nutrix-shopping", onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(storageKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  let ticked = new Set<string>();
  try {
    ticked = new Set(JSON.parse(raw) as string[]);
  } catch {
    // Unreadable: start with nothing ticked.
  }
  const total = groups.reduce((a, g) => a + g.items.length, 0);

  function save(next: Set<string>) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // Private mode: ticks can't be kept.
    }
    window.dispatchEvent(new Event("nutrix-shopping"));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted tabular-nums">{t.left(total - ticked.size, total)}</span>
        {ticked.size > 0 && (
          <button type="button" onClick={() => save(new Set())} className="font-medium text-muted underline underline-offset-4 hover:text-ink">
            {t.clear}
          </button>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.id} className="rounded-2xl border border-line bg-surface">
          <p className="px-5 pt-4 pb-2 text-sm font-semibold">{g.title}</p>
          <ul className="rise-list divide-y divide-line px-2 pb-2">
            {g.items.map((it) => {
              const on = ticked.has(it.key);
              return (
                <li key={it.key}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = new Set(ticked);
                        if (on) next.delete(it.key);
                        else next.add(it.key);
                        save(next);
                      }}
                      className="size-5 shrink-0 accent-ink"
                    />
                    <span data-on={on} className="tick min-w-0 flex-1 text-sm">
                      <bdi>{it.name}</bdi>
                      {it.alt && (
                        <bdi className="block text-xs text-muted" dir="ltr">
                          {it.alt}
                        </bdi>
                      )}
                    </span>
                    <span data-on={on} className="tick shrink-0 text-sm text-ink/80 tabular-nums">{it.amount}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
