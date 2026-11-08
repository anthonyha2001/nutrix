import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SavedContent, Targets } from "@/lib/nutrition";

// The patient's active plan, if their dietitian has given them one.
export async function activePlan(patientId: string) {
  const supabase = await createClient();
  const [{ data: plan }, { data: practice }] = await Promise.all([
    supabase.from("meal_plans").select("id, name, starts_on, ends_on, notes, targets, content").eq("patient_id", patientId).eq("status", "active").maybeSingle(),
    supabase.from("patients").select("practices(timezone)").eq("id", patientId).maybeSingle(),
  ]);
  return {
    plan: plan ? { ...plan, content: plan.content as SavedContent, targets: plan.targets as Targets } : null,
    timezone: (practice as { practices?: { timezone?: string } } | null)?.practices?.timezone ?? "Asia/Beirut",
  };
}
