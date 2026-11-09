"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { sendAppInvite, sendIntakeForm } from "@/lib/whatsapp-events";

// Owner: send from the Nutrix number, or from the practice's own WhatsApp API.
export async function saveWhatsAppSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const useOwn = text(formData, "sender") === "own";
  const { error } = await (await createClient()).rpc("practice_set_whatsapp", {
    p_practice_id: membership.practiceId,
    p_use_own: useOwn,
    p_phone_number_id: useOwn ? text(formData, "phone_number_id") : undefined,
    p_token: useOwn ? text(formData, "token") : undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: useOwn ? "Now sending from your WhatsApp number" : "Now sending from the Nutrix number" };
}

const REASONS: Record<string, string> = {
  no_phone: "This patient has no phone number in their file.",
  not_connected: "WhatsApp isn't connected yet. Set it up in WhatsApp.",
  off: "Automatic WhatsApp is switched off for this practice.",
  already_sent: "Already sent today.",
  not_found: "Patient not found.",
  failed: "WhatsApp refused the message. See the WhatsApp log for the reason.",
};

const result = (r: { ok?: true; error?: string } | undefined): ActionState => {
  refresh();
  return r?.ok ? { success: "Sent on WhatsApp" } : { error: REASONS[r?.error ?? "failed"] ?? REASONS.failed };
};

export async function sendAppInviteAction(patientId: string, url: string): Promise<ActionState> {
  await requireStaff();
  return result(await sendAppInvite(patientId, url));
}

export async function sendIntakeAction(patientId: string, url: string): Promise<ActionState> {
  await requireStaff(BILLING_ROLES.concat("dietitian"));
  return result(await sendIntakeForm(patientId, url));
}
