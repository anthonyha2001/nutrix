"use server";

import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { requirePatient } from "@/lib/session";
import { localToIso } from "@/lib/time";
import type { Json } from "@/lib/supabase/database.types";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export type LogInput = { date: string; slot: string; foodId: string; grams: number; serving?: { label: string; qty: number; unit_g: number } | null };

export async function logFood(input: LogInput): Promise<ActionState> {
  await requirePatient();
  if (!isDate(input.date) || !SLOTS.includes(input.slot)) return { error: "Choose a day and a meal." };
  const { error } = await (await createClient()).rpc("log_food", {
    p_eaten_on: input.date,
    p_slot: input.slot,
    p_food_id: input.foodId,
    p_grams: input.grams,
    p_serving: (input.serving ?? null) as Json,
  });
  return error ? { error: errorMessage(error, "Couldn't log it.") } : done("Added to your diary");
}

// "I ate this meal": each planned food, or the swap chosen instead.
export async function logPlanMeal(
  date: string,
  slot: string,
  mealKey: string,
  items: { foodId: string; grams: number; serving?: LogInput["serving"]; swap: boolean }[],
): Promise<ActionState> {
  await requirePatient();
  if (!isDate(date) || !SLOTS.includes(slot) || !items.length) return { error: "Nothing to log." };
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
    if (error) return { error: errorMessage(error, "Couldn't log the meal.") };
  }
  return done("Meal logged");
}

export async function deleteEntry(id: string): Promise<ActionState> {
  await requirePatient();
  const { error } = await (await createClient()).from("diary_entries").delete().eq("id", id);
  return error ? { error: errorMessage(error) } : done("Removed");
}

export async function addWater(date: string, ml: number): Promise<ActionState> {
  await requirePatient();
  const { error } = await (await createClient()).rpc("add_water", { p_day: date, p_ml: ml });
  return error ? { error: errorMessage(error) } : done(ml > 0 ? `+${ml} ml` : "Water updated");
}

export async function saveCheckin(date: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePatient();
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
  return error ? { error: errorMessage(error, "Couldn't save.") } : done("Check-in saved");
}

export async function recordWeight(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, link } = await requirePatient();
  const kg = Number(text(formData, "weight_kg").replace(",", "."));
  if (!(kg >= 20 && kg <= 400)) return { error: "Enter your weight in kg." };
  const { error } = await (await createClient()).from("measurements").insert({
    patient_id: link.patientId,
    weight_kg: Math.round(kg * 10) / 10,
    measured_on: text(formData, "measured_on") || undefined,
    source: "patient",
    recorded_by: viewer.id,
  });
  return error ? { error: errorMessage(error, "Couldn't save.") } : done("Weight saved");
}

export async function requestAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { link } = await requirePatient();
  const date = text(formData, "date");
  const time = text(formData, "time");
  if (!isDate(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Choose a day and a time." };
  const { error } = await (await createClient()).rpc("request_appointment", {
    p_starts_at: localToIso(date, time, link.timezone),
    p_note: text(formData, "note"),
  });
  return error ? { error: errorMessage(error, "Couldn't send the request.") } : done("Request sent. Your dietitian will confirm.");
}

export async function cancelMyAppointment(id: string): Promise<ActionState> {
  await requirePatient();
  const { error } = await (await createClient()).rpc("cancel_appointment", { p_id: id, p_reason: "Cancelled by the patient" });
  return error ? { error: errorMessage(error) } : done("Appointment cancelled");
}
