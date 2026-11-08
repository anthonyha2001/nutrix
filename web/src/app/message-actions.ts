"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { requireViewer } from "@/lib/session";

// Sent by the patient (in their own thread) or by one of their clinicians.
// Row-level security decides who may write where.
export async function sendMessage(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const body = text(formData, "body");
  if (!body) return {};
  if (body.length > 4000) return { error: "That message is too long." };
  const fromPatient = viewer.patientOf.some((p) => p.patientId === patientId);
  const { error } = await (await createClient()).from("messages").insert({ patient_id: patientId, sender_id: viewer.id, from_patient: fromPatient, body });
  if (error) return { error: errorMessage(error, "Couldn't send.") };
  refresh();
  return { success: "sent" };
}
