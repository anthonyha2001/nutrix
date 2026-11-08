import type { Database } from "@/lib/supabase/database.types";

export type PracticeRole = Database["public"]["Enums"]["practice_role"];

export const ROLE_LABELS: Record<PracticeRole, string> = {
  owner: "Owner",
  dietitian: "Dietitian",
  assistant: "Assistant",
};

// Who works with clinical data (plans, notes, measurements). Assistants handle
// appointments and billing only; the database enforces this per patient
// (public.can_see_clinical), these lists only shape the navigation.
export const CLINICAL_ROLES: PracticeRole[] = ["owner", "dietitian"];
export const BILLING_ROLES: PracticeRole[] = ["owner", "assistant"];
export const OWNER_ONLY: PracticeRole[] = ["owner"];
