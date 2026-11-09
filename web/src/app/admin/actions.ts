"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { requirePlatformAdmin, type SupportRole } from "@/lib/session";

const ROLES: SupportRole[] = ["owner", "dietitian", "assistant", "patient"];

// Support access: open a practice as one of its roles (patient: lab only).
export async function openPracticeAs(practiceId: string, role: SupportRole = "owner") {
  await requirePlatformAdmin();
  const { error } = await (await createClient()).rpc("admin_open_practice", { p_practice_id: practiceId, p_role: role });
  if (error) throw new Error(errorMessage(error, "Couldn't open the practice."));
  // Every page depends on who you are acting as: drop the browser's cached pages.
  revalidatePath("/", "layout");
  redirect(role === "patient" ? "/patient" : "/dashboard");
}

// "Open as" form: a practice and a role.
export async function openPracticeForm(formData: FormData) {
  const role = text(formData, "role") as SupportRole;
  await openPracticeAs(text(formData, "practice_id"), ROLES.includes(role) ? role : "owner");
}

export async function createLab() {
  await requirePlatformAdmin();
  const { data, error } = await (await createClient()).rpc("admin_create_lab");
  if (error || !data) throw new Error(errorMessage(error ?? { message: "" }, "Couldn't create the lab."));
  await openPracticeAs(data, "owner");
}

export async function leaveSupport() {
  await requirePlatformAdmin();
  await (await createClient()).rpc("admin_leave_practice");
  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function setRollout(key: string, rollout: string) {
  await requirePlatformAdmin();
  const { error } = await (await createClient()).rpc("admin_set_rollout", { p_key: key, p_rollout: rollout });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "Saved" };
}

export async function setOverride(key: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const practiceId = text(formData, "practice_id");
  if (!practiceId) return { error: "Choose a practice." };
  const { error } = await (await createClient()).rpc("admin_set_override", { p_practice_id: practiceId, p_key: key, p_value: text(formData, "value") });
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Saved" };
}

// Keys for the Nutrix WhatsApp number (Meta WhatsApp Cloud API). A blank token keeps the saved one.
export async function saveWhatsAppKeys(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const phoneId = text(formData, "phone_number_id");
  if (phoneId && !/^d{6,20}$/.test(phoneId)) return { error: "The phone number ID is the long number from WhatsApp Manager." };
  const { error } = await (await createClient()).rpc("admin_set_whatsapp_keys", { p_token: text(formData, "token"), p_phone_number_id: phoneId });
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "WhatsApp keys saved" };
}
