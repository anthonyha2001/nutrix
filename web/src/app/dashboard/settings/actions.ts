"use server";

import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { requireStaff } from "@/lib/session";

export async function savePractice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const name = text(formData, "name");
  const timezone = text(formData, "timezone");
  const rate = Number(text(formData, "lbp_rate").replace(/[,\s]/g, ""));
  if (name.length < 2 || name.length > 80) return { error: "Practice name must be between 2 and 80 characters." };
  if (!Intl.supportedValuesOf("timeZone").includes(timezone)) return { error: "Choose a timezone." };
  if (!(rate > 0)) return { error: "Enter the LBP rate for 1 USD." };
  const { error } = await (await createClient()).from("practices").update({ name, timezone, lbp_rate: rate }).eq("id", membership.practiceId);
  return error ? { error: errorMessage(error, "Couldn't save.") } : done("Practice saved");
}
