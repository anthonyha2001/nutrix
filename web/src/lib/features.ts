import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Feature switches set by the super admin (/admin, Lab tab): off, lab
// practices only, or everyone, with per-practice exceptions.
export type FeatureKey = "messages" | "patient_diary" | "patient_booking";

// If the switches can't be read, keep everything that was live on.
const LIVE: FeatureKey[] = ["messages", "patient_diary", "patient_booking"];

export const practiceFeatures = cache(async (practiceId: string): Promise<Set<string>> => {
  const { data, error } = await (await createClient()).rpc("practice_features", { p_practice_id: practiceId });
  if (error) return new Set(LIVE);
  return new Set(data ?? []);
});

export async function hasFeature(practiceId: string, key: FeatureKey) {
  return (await practiceFeatures(practiceId)).has(key);
}
