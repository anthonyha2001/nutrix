"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { text, type ActionState } from "@/lib/action-result";
import { patientError, PATIENT_TEXT, type Lang } from "@/lib/patient-i18n";
import { patientLang } from "@/lib/patient-lang";
import { requirePatient } from "@/lib/session";
import { localToIso } from "@/lib/time";
import type { Json } from "@/lib/supabase/database.types";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

// The patient, their language, and helpers to answer in it.
async function patient() {
  const ctx = await requirePatient();
  const lang = await patientLang(ctx.viewer);
  const t = PATIENT_TEXT[lang];
  const fail = (error?: { message?: string } | string): ActionState => ({ error: patientError(typeof error === "string" ? error : error?.message, lang) });
  const ok = (message: string): ActionState => {
    refresh();
    return { success: message };
  };
  return { ...ctx, lang, t, fail, ok };
}

export type LogInput = { date: string; slot: string; foodId: string; grams: number; serving?: { label: string; qty: number; unit_g: number } | null };

export async function logFood(input: LogInput): Promise<ActionState> {
  const { t, fail, ok } = await patient();
  if (!isDate(input.date) || !SLOTS.includes(input.slot)) return { error: t.errors.dayMeal };
  const { error } = await (await createClient()).rpc("log_food", {
    p_eaten_on: input.date,
    p_slot: input.slot,
    p_food_id: input.foodId,
    p_grams: input.grams,
    p_serving: (input.serving ?? null) as Json,
  });
  return error ? fail(error) : ok(t.done.logged);
}

// "I ate this meal": each planned food, or the swap chosen instead.
export async function logPlanMeal(
  date: string,
  slot: string,
  mealKey: string,
  items: { foodId: string; grams: number; serving?: LogInput["serving"]; swap: boolean }[],
): Promise<ActionState> {
  const { t, fail, ok } = await patient();
  if (!isDate(date) || !SLOTS.includes(slot) || !items.length) return { error: t.errors.nothing };
  const supabase = await createClient();
  for (const i of items) {
    const { error } = await supabase.rpc("log_food", {
      p_eaten_on: date,
      p_slot: slot,
      p_food_id: i.foodId,
      p_grams: i.grams,
      p_serving: (i.serving ?? null) as Json,
      p_source: i.swap ? "swap" : "plan",
      p_plan_meal_key: mealKey,
    });
    if (error) return fail(error);
  }
  return ok(t.done.meal);
}

export async function deleteEntry(id: string): Promise<ActionState> {
  const { t, fail, ok } = await patient();
  const { error } = await (await createClient()).from("diary_entries").delete().eq("id", id);
  return error ? fail(error) : ok(t.done.removed);
}

export async function addWater(date: string, ml: number): Promise<ActionState> {
  const { t, fail, ok } = await patient();
  const { error } = await (await createClient()).rpc("add_water", { p_day: date, p_ml: ml });
  return error ? fail(error) : ok(t.done.water(ml));
}

export async function saveCheckin(date: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, fail, ok } = await patient();
  const scale = (k: string) => {
    const n = Number(text(formData, k));
    return n >= 1 && n <= 5 ? n : undefined;
  };
  const sleep = Number(text(formData, "sleep_hours").replace(",", "."));
  const { error } = await (await createClient()).rpc("save_checkin", {
    p_day: date,
    p_mood: scale("mood"),
    p_energy: scale("energy"),
    p_hunger: scale("hunger"),
    p_followed_plan: scale("followed_plan"),
    p_sleep_hours: sleep > 0 && sleep <= 24 ? sleep : undefined,
    p_note: text(formData, "note"),
  });
  return error ? fail(error) : ok(t.done.checkin);
}

export async function recordWeight(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, link, t, fail, ok } = await patient();
  const kg = Number(text(formData, "weight_kg").replace(",", "."));
  if (!(kg >= 20 && kg <= 400)) return { error: t.errors.weight };
  const { error } = await (await createClient()).from("measurements").insert({
    patient_id: link.patientId,
    weight_kg: Math.round(kg * 10) / 10,
    measured_on: text(formData, "measured_on") || undefined,
    source: "patient",
    recorded_by: viewer.id,
  });
  return error ? fail(error) : ok(t.done.weight);
}

export async function requestAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { link, t, fail, ok } = await patient();
  const date = text(formData, "date");
  const time = text(formData, "time");
  if (!isDate(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: t.errors.dayTime };
  const { error } = await (await createClient()).rpc("request_appointment", {
    p_starts_at: localToIso(date, time, link.timezone),
    p_note: text(formData, "note"),
  });
  return error ? fail(error) : ok(t.done.request);
}

export async function cancelMyAppointment(id: string): Promise<ActionState> {
  const { t, fail, ok } = await patient();
  const { error } = await (await createClient()).rpc("cancel_appointment", { p_id: id, p_reason: "Cancelled by the patient" });
  return error ? fail(error) : ok(t.done.cancelled);
}

// The app's language for this account.
export async function setLanguage(lang: Lang): Promise<ActionState> {
  const { viewer, fail } = await patient();
  if (lang !== "en" && lang !== "ar") return fail();
  const { error } = await (await createClient()).from("profiles").update({ locale: lang }).eq("id", viewer.id);
  if (error) return fail(error);
  // Every screen changes language: drop the browser's cached pages.
  revalidatePath("/", "layout");
  return { success: PATIENT_TEXT[lang].done.language };
}

// Meal reminders: this device's push subscription.
export async function saveSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<ActionState> {
  const { viewer, link, t, fail } = await patient();
  if (!sub.endpoint.startsWith("https://") || !sub.p256dh || !sub.auth) return fail();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_id: viewer.id, patient_id: link.patientId });
  return error ? fail(error) : { success: t.done.reminders };
}

export async function deleteSubscription(endpoint: string): Promise<ActionState> {
  const { t } = await patient();
  await (await createClient()).from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { success: t.done.remindersOff };
}
