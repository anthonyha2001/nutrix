"use server";

import { done } from "@/lib/done";
import { errorMessage, type ActionState } from "@/lib/action-result";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Confirms the Arabic or French names of foods for this practice (reused in every plan).
export async function saveFoodNames(lang: "ar" | "fr", names: { foodId: string; name: string }[]): Promise<ActionState> {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  if (lang !== "ar" && lang !== "fr") return { error: "Unknown language." };
  const supabase = await createClient();
  for (const n of names.slice(0, 200)) {
    const { error } = await supabase.rpc("save_food_translation", { p_practice_id: membership.practiceId, p_food_id: n.foodId, p_lang: lang, p_name: n.name });
    if (error) return { error: errorMessage(error, "Couldn't save the names.") };
  }
  return done(`${names.length} name${names.length === 1 ? "" : "s"} saved`);
}
