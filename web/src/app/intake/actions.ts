"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-result";
import type { Json } from "@/lib/supabase/database.types";

const TEXT_FIELDS = [
  "date_of_birth", "sex", "phone", "height_cm", "weight_kg", "activity_level", "goal",
  "conditions", "family_history", "medications", "other_allergies",
  "meals_per_day", "typical_day", "likes", "dislikes", "previous_diets",
  "sleep", "work", "exercise", "smoking", "anything_else",
] as const;

// The patient sends the intake form (no account). The database checks the
// token, that it is open and unused, and what each answer may change.
export async function submitIntake(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const answers: { [key: string]: Json } = {};
  for (const k of TEXT_FIELDS) {
    const v = String(formData.get(k) ?? "").trim().slice(0, 2000);
    if (v) answers[k] = v;
  }
  answers.allergies = formData.getAll("allergies").map(String).slice(0, 20);
  const { error } = await (await createClient()).rpc("intake_submit", { p_token: token, p_answers: answers });
  if (error) return { error: error.code === "22023" || error.code === "P0002" ? error.message : "Couldn't send the form. Check your connection and try again." };
  return { success: "sent" };
}
