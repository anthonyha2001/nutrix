"use server";

import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { localToIso } from "@/lib/time";

export async function bookAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff();
  const patientId = text(formData, "patient_id");
  const date = text(formData, "date");
  const time = text(formData, "time");
  if (!patientId) return { error: "Choose a patient." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Choose a date and time." };
  const duration = Number(text(formData, "duration_min")) || undefined;
  const { error } = await (await createClient()).rpc("book_appointment", {
    p_patient_id: patientId,
    p_starts_at: localToIso(date, time, membership.timezone),
    p_duration_min: duration,
    p_service_id: text(formData, "service_id") || undefined,
    p_dietitian_id: text(formData, "dietitian_id") || undefined,
    p_online: formData.get("online") === "on",
    p_note: text(formData, "note"),
  });
  return error ? { error: errorMessage(error, "Couldn't book.") } : done("Appointment booked");
}

export async function rescheduleAppointment(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff();
  const date = text(formData, "date");
  const time = text(formData, "time");
  if (!date || !time) return { error: "Choose a date and time." };
  const { error } = await (await createClient()).rpc("reschedule_appointment", {
    p_id: id,
    p_starts_at: localToIso(date, time, membership.timezone),
    p_duration_min: Number(text(formData, "duration_min")) || undefined,
  });
  return error ? { error: errorMessage(error, "Couldn't move it.") } : done("Appointment moved");
}

export async function confirmAppointment(id: string): Promise<ActionState> {
  await requireStaff();
  const { error } = await (await createClient()).rpc("confirm_appointment", { p_id: id });
  return error ? { error: errorMessage(error) } : done("Appointment confirmed");
}

export async function cancelAppointment(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const { error } = await (await createClient()).rpc("cancel_appointment", { p_id: id, p_reason: text(formData, "reason") });
  return error ? { error: errorMessage(error) } : done("Appointment cancelled");
}

export async function markAttendance(id: string, attended: boolean): Promise<ActionState> {
  await requireStaff();
  const { data, error } = await (await createClient()).rpc("complete_appointment", { p_id: id, p_attended: attended });
  if (error) return { error: errorMessage(error) };
  return done(!attended ? "Marked as no-show" : data ? "Attended. Invoice created." : "Attended");
}

export async function addAppointmentNote(patientId: string, appointmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireStaff(CLINICAL_ROLES);
  const body = text(formData, "body");
  if (!body) return { error: "Write the note first." };
  const { error } = await (await createClient()).from("consultation_notes").insert({
    patient_id: patientId,
    appointment_id: appointmentId,
    author_id: viewer.id,
    title: text(formData, "title") || null,
    body,
    noted_on: text(formData, "noted_on") || undefined,
  });
  return error ? { error: errorMessage(error, "Couldn't save.") } : done("Note added");
}
