import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/format";
import type { SavedContent, Targets } from "@/lib/nutrition";
import { addDays } from "@/lib/time";

// Everything a dietitian wants to glance at before a consultation. Caller
// must already know they can see the clinical file.
export async function patientSummary(patientId: string, timeZone: string) {
  const supabase = await createClient();
  const today = todayIn(timeZone);
  const from = addDays(today, -6);
  const [{ data: weights }, { data: plan }, { data: diary }, { data: checkins }, { data: note }, { data: allergies }] = await Promise.all([
    supabase.from("measurements").select("measured_on, weight_kg").eq("patient_id", patientId).not("weight_kg", "is", null).order("measured_on", { ascending: false }).limit(2),
    supabase.from("meal_plans").select("name, targets, content->totals").eq("patient_id", patientId).eq("status", "active").maybeSingle(),
    supabase.from("diary_entries").select("eaten_on, kcal").eq("patient_id", patientId).gte("eaten_on", from).lte("eaten_on", today),
    supabase.from("daily_checkins").select("day, mood, followed_plan, water_ml, checked_in_at").eq("patient_id", patientId).gte("day", from).lte("day", today),
    supabase.from("consultation_notes").select("noted_on, title, body").eq("patient_id", patientId).order("noted_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("patient_allergies").select("allergen, label").eq("patient_id", patientId),
  ]);

  const days = new Map<string, number>();
  for (const e of diary ?? []) days.set(e.eaten_on, (days.get(e.eaten_on) ?? 0) + Number(e.kcal));
  const checked = (checkins ?? []).filter((c) => c.checked_in_at);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    latestWeight: weights?.[0] ? { date: weights[0].measured_on, kg: Number(weights[0].weight_kg) } : null,
    weightChange: weights && weights.length === 2 ? Number(weights[0].weight_kg) - Number(weights[1].weight_kg) : null,
    plan: plan ? { name: plan.name, targets: plan.targets as Targets, totals: plan.totals as SavedContent["totals"] } : null,
    daysLogged: days.size,
    avgKcal: avg([...days.values()]),
    checkIns: checked.length,
    avgMood: avg(checked.map((c) => c.mood).filter((x): x is number => x !== null)),
    avgFollowed: avg(checked.map((c) => c.followed_plan).filter((x): x is number => x !== null)),
    avgWater: avg((checkins ?? []).map((c) => c.water_ml).filter((x) => x > 0)),
    lastNote: note,
    allergies: allergies ?? [],
  };
}

export type PatientSummary = Awaited<ReturnType<typeof patientSummary>>;
