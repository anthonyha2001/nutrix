"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";

const ALLERGENS = ["gluten", "dairy", "egg", "peanut", "tree_nut", "sesame", "soy", "fish", "shellfish", "other"];
const ACTIVITY = ["sedentary", "light", "moderate", "active", "very_active"] as const;

function optionalNumber(formData: FormData, key: string) {
  const raw = text(formData, key).replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function patientFields(formData: FormData) {
  const sex = text(formData, "sex");
  return {
    full_name: text(formData, "full_name"),
    email: text(formData, "email").toLowerCase() || null,
    phone: text(formData, "phone") || null,
    date_of_birth: text(formData, "date_of_birth") || null,
    sex: sex === "female" || sex === "male" ? sex : null,
  } as const;
}

function validPatient(p: ReturnType<typeof patientFields>) {
  if (p.full_name.length < 2) return "Enter the patient's full name.";
  if (p.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) return "That email doesn't look right.";
  return null;
}

export async function createPatient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, membership } = await requireStaff();
  const fields = patientFields(formData);
  const invalid = validPatient(fields);
  if (invalid) return { error: invalid };
  // Dietitians add patients for themselves; owners and assistants choose.
  const chosen = text(formData, "dietitian_id");
  const dietitianId = membership.role === "dietitian" ? viewer.id : chosen || (membership.role === "owner" ? viewer.id : null);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({ ...fields, practice_id: membership.practiceId, dietitian_id: dietitianId })
    .select("id")
    .single();
  if (error) return { error: errorMessage(error, "Couldn't add the patient.") };
  redirect(`/dashboard/patients/${data.id}`);
}

export async function updatePatient(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const fields = patientFields(formData);
  const invalid = validPatient(fields);
  if (invalid) return { error: invalid };
  const { error } = await (await createClient()).from("patients").update(fields).eq("id", patientId);
  return error ? { error: errorMessage(error, "Couldn't save.") } : done("Patient updated");
}

export async function assignDietitian(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["owner", "assistant"]);
  const id = text(formData, "dietitian_id") || null;
  const { error } = await (await createClient()).from("patients").update({ dietitian_id: id }).eq("id", patientId);
  return error ? { error: errorMessage(error, "Couldn't assign.") } : done(id ? "Dietitian assigned" : "Unassigned");
}

export async function setPatientArchived(patientId: string, archived: boolean): Promise<ActionState> {
  await requireStaff();
  const { error } = await (await createClient())
    .from("patients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", patientId);
  return error ? { error: errorMessage(error) } : done(archived ? "Patient archived" : "Patient restored");
}

export async function deletePatient(patientId: string): Promise<ActionState> {
  await requireStaff(["owner"]);
  const { error, count } = await (await createClient()).from("patients").delete({ count: "exact" }).eq("id", patientId);
  if (error) return { error: errorMessage(error) };
  if (!count) return { error: "Only the practice owner can delete a patient." };
  redirect("/dashboard/patients");
}

// ---------------------------------------------------------------- clinical

export async function saveHealth(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireStaff(CLINICAL_ROLES);
  const height = optionalNumber(formData, "height_cm");
  if (Number.isNaN(height) || (height !== null && (height < 40 || height > 250))) return { error: "Height must be in centimetres (40 to 250)." };
  const target = optionalNumber(formData, "target_weight_kg");
  if (Number.isNaN(target) || (target !== null && (target < 20 || target > 400))) return { error: "Target weight must be in kilograms (20 to 400)." };
  const activity = text(formData, "activity_level");
  const row = {
    patient_id: patientId,
    height_cm: height,
    target_weight_kg: target,
    activity_level: (ACTIVITY as readonly string[]).includes(activity) ? (activity as (typeof ACTIVITY)[number]) : null,
    goal: text(formData, "goal") || null,
    medical_history: text(formData, "medical_history") || null,
    medications: text(formData, "medications") || null,
    nutrition_history: text(formData, "nutrition_history") || null,
    lifestyle: text(formData, "lifestyle") || null,
    updated_by: viewer.id,
  };
  const { error } = await (await createClient()).from("patient_health").upsert(row);
  return error ? { error: errorMessage(error, "Couldn't save.") } : done("Health history saved");
}

export async function addAllergy(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const allergen = text(formData, "allergen");
  const label = text(formData, "label");
  if (!ALLERGENS.includes(allergen)) return { error: "Choose an allergen." };
  if (allergen === "other" && !label) return { error: "Name the allergen." };
  const kind = text(formData, "kind") === "intolerance" ? "intolerance" : "allergy";
  const severity = ["mild", "moderate", "severe"].includes(text(formData, "severity")) ? text(formData, "severity") : "moderate";
  const { error } = await (await createClient()).from("patient_allergies").insert({
    patient_id: patientId,
    allergen,
    label: label || null,
    kind,
    severity,
    notes: text(formData, "notes") || null,
  });
  return error ? { error: errorMessage(error, "Couldn't add.") } : done(kind === "allergy" ? "Allergy added" : "Intolerance added");
}

export async function removeAllergy(id: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).from("patient_allergies").delete().eq("id", id);
  return error ? { error: errorMessage(error) } : done("Removed");
}

const METRICS = ["weight_kg", "body_fat_pct", "muscle_mass_kg", "body_water_pct", "visceral_fat", "bmr_kcal", "waist_cm", "hip_cm"] as const;

export async function addMeasurement(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireStaff(CLINICAL_ROLES);
  const values: Partial<Record<(typeof METRICS)[number], number | null>> = {};
  for (const m of METRICS) {
    const v = optionalNumber(formData, m);
    if (Number.isNaN(v)) return { error: "Numbers only, please." };
    values[m] = m === "bmr_kcal" && v !== null ? Math.round(v) : v;
  }
  if (METRICS.every((m) => values[m] === null)) return { error: "Enter at least one measurement." };
  const { error } = await (await createClient()).from("measurements").insert({
    patient_id: patientId,
    measured_on: text(formData, "measured_on") || undefined,
    ...values,
    notes: text(formData, "notes") || null,
    recorded_by: viewer.id,
    source: "manual",
  });
  if (error?.code === "23514") return { error: "One of the values is out of range. Check the units." };
  return error ? { error: errorMessage(error, "Couldn't save.") } : done("Measurement saved");
}

export async function deleteMeasurement(id: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).from("measurements").delete().eq("id", id);
  return error ? { error: errorMessage(error) } : done("Measurement deleted");
}

export async function saveNote(patientId: string, noteId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireStaff(CLINICAL_ROLES);
  const body = text(formData, "body");
  if (!body) return { error: "Write the note first." };
  const fields = { title: text(formData, "title") || null, body, noted_on: text(formData, "noted_on") || undefined };
  const supabase = await createClient();
  const { error } = noteId
    ? await supabase.from("consultation_notes").update(fields).eq("id", noteId)
    : await supabase.from("consultation_notes").insert({ ...fields, patient_id: patientId, author_id: viewer.id });
  return error ? { error: errorMessage(error, "Couldn't save.") } : done(noteId ? "Note updated" : "Note added");
}

export async function deleteNote(id: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).from("consultation_notes").delete().eq("id", id);
  return error ? { error: errorMessage(error) } : done("Note deleted");
}
