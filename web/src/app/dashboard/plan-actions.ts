"use server";

import { after } from "next/server";
import { notifyPlanReady } from "@/lib/whatsapp-events";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import type { BuilderMeta, TemplateKind } from "@/components/plan-builder";
import type { Json } from "@/lib/supabase/database.types";

type Content = { days: unknown[] };

const KINDS: TemplateKind[] = ["meal", "day", "week", "program"];

// `give`: also hand the plan to the patient (the previous active plan moves to
// previous plans), so the builder can do it in one step.
export async function savePlanAction(
  patientId: string,
  planId: string | null,
  input: BuilderMeta & { content: Content },
  options?: { give?: boolean },
): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const supabase = await createClient();
  const { data: savedId, error } = await supabase.rpc("save_meal_plan", {
    p_patient_id: patientId,
    p_id: planId ?? undefined,
    p_name: input.name,
    p_starts_on: input.startsOn || undefined,
    p_ends_on: input.endsOn || undefined,
    p_targets: (input.targets ?? {}) as Json,
    p_notes: input.notes ?? "",
    p_content: input.content as Json,
  });
  if (error) return { error: errorMessage(error, "Couldn't save the plan.") };
  if (options?.give && savedId) {
    const { error: giveError } = await supabase.rpc("activate_meal_plan", { p_id: savedId });
    if (giveError) return { error: errorMessage(giveError, "The plan was saved as a draft, but couldn't be given to the patient.") };
    after(() => notifyPlanReady(savedId));
    return done("Plan given to the patient");
  }
  return done(planId ? "Plan saved" : "Plan created");
}

export async function saveTemplateAction(templateId: string | null, kind: TemplateKind, input: BuilderMeta & { content: Content }): Promise<ActionState> {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_template", {
    p_practice_id: membership.practiceId,
    p_id: templateId ?? undefined,
    p_kind: kind,
    p_name: input.name,
    p_category: input.category ?? "",
    p_description: input.description ?? "",
    p_content: input.content as Json,
  });
  if (error) return { error: errorMessage(error, "Couldn't save the template.") };
  return done(templateId ? "Template saved" : "Template created");
}

export async function activatePlan(planId: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).rpc("activate_meal_plan", { p_id: planId });
  if (!error) after(() => notifyPlanReady(planId));
  return error ? { error: errorMessage(error) } : done("Plan given to the patient");
}

export async function archivePlan(planId: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).rpc("archive_meal_plan", { p_id: planId });
  return error ? { error: errorMessage(error) } : done("Plan moved to previous plans");
}

export async function deleteDraftPlan(planId: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error, count } = await (await createClient()).from("meal_plans").delete({ count: "exact" }).eq("id", planId).eq("status", "draft");
  if (error) return { error: errorMessage(error) };
  return count ? done("Draft deleted") : { error: "Only drafts can be deleted." };
}

// Starts a plan from a template and opens it in the builder.
export async function planFromTemplate(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const templateId = text(formData, "template_id");
  if (!templateId) return { error: "Choose a template." };
  const { data, error } = await (await createClient()).rpc("plan_from_template", { p_patient_id: patientId, p_template_id: templateId });
  if (error) return { error: errorMessage(error, "Couldn't create the plan.") };
  redirect(`/dashboard/patients/${patientId}?tab=plans&plan=${data}`);
}

export async function templateFromPlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const name = text(formData, "name");
  const kind = text(formData, "kind") as TemplateKind;
  if (!name) return { error: "Give the template a name." };
  if (!KINDS.includes(kind)) return { error: "Choose a template type." };
  const { error } = await (await createClient()).rpc("template_from_plan", { p_plan_id: planId, p_name: name, p_kind: kind });
  return error ? { error: errorMessage(error, "Couldn't save the template.") } : done("Saved to your templates");
}

export async function duplicateTemplate(templateId: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).rpc("duplicate_template", { p_id: templateId });
  return error ? { error: errorMessage(error) } : done("Template duplicated");
}

export async function deleteTemplate(templateId: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).from("templates").delete().eq("id", templateId);
  return error ? { error: errorMessage(error) } : done("Template deleted");
}

export async function setTemplateFavorite(templateId: string, favorite: boolean): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error } = await (await createClient()).from("templates").update({ is_favorite: favorite }).eq("id", templateId);
  return error ? { error: errorMessage(error) } : done(favorite ? "Added to favourites" : "Removed from favourites");
}

// Copies a plan into a new draft and opens it in the builder: for the same
// patient ("Duplicate") or another one ("Copy to another patient"). Targets are
// kept only for the same patient; another patient gets suggestions from their
// own numbers in the builder.
async function copyPlanTo(planId: string, targetPatientId: string | null) {
  const supabase = await createClient();
  const { data: plan } = await supabase.from("meal_plans").select("patient_id, name, targets, notes, content").eq("id", planId).maybeSingle();
  if (!plan) return { error: "Plan not found." };
  const to = targetPatientId || plan.patient_id;
  const same = to === plan.patient_id;
  const { data: id, error } = await supabase.rpc("save_meal_plan", {
    p_patient_id: to,
    p_name: same ? `${plan.name} (copy)`.slice(0, 120) : plan.name,
    p_targets: (same ? plan.targets : {}) as Json,
    p_notes: plan.notes ?? "",
    p_content: plan.content as Json,
  });
  if (error) return { error: errorMessage(error, "Couldn't copy the plan.") };
  if (!id) return { error: "Couldn't copy the plan." };
  redirect(`/dashboard/patients/${to}?tab=plans&plan=${id}`);
}

export async function duplicatePlan(planId: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  return copyPlanTo(planId, null);
}

export async function copyPlanToPatient(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const patientId = text(formData, "patient_id");
  if (!patientId) return { error: "Choose a patient." };
  return copyPlanTo(planId, patientId);
}
