import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AlertTriangle, ArrowLeft, CalendarPlus, Lock, MessageCircle, NotebookTabs, PenLine, Plus, Scale, Smartphone, Stethoscope } from "lucide-react";
import { hasFeature } from "@/lib/features";
import { guessGoal, suggestTargets, type TargetProfile } from "@/lib/energy";
import { projectGoal, projectionText } from "@/lib/projection";
import { aiConfigured } from "@/lib/import/ai-read";
import { ActionButton } from "@/components/action-button";
import { Dialog } from "@/components/dialog";
import { InviteShare } from "@/components/invite-share";
import { SendWhatsApp } from "@/components/send-whatsapp";
import { sendAppInviteAction, sendPlanPdfAction } from "../../whatsapp/actions";
import { MacroSummary } from "@/components/macro-summary";
import { PageTabs, TabPanel } from "@/components/page-tabs";
import { PlanBuilder } from "@/components/plan-builder";
import { RouteModal } from "@/components/route-modal";
import { RowMenu } from "@/components/row-menu";
import { TrendChart } from "@/components/trend-chart";
import { Badge, buttonClass, Card, EmptyState, SectionTitle } from "@/components/ui";
import { ageOn, bmi, formatDate, num, todayIn } from "@/lib/format";
import { patientInviteMessage } from "@/lib/invite-link";
import { ALLERGEN_LABELS, contentToDays, type SavedContent, type Targets } from "@/lib/nutrition";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  activatePlan,
  archivePlan,
  copyPlanToPatient,
  deleteDraftPlan,
  duplicatePlan,
  planFromTemplate,
  savePlanAction,
  templateFromPlan,
} from "../../plan-actions";
import {
  addAllergy,
  addMeasurement,
  deleteMeasurement,
  deleteNote,
  removeAllergy,
  saveHealth,
  saveNote,
  updatePatient,
} from "../actions";
import { AppointmentDetail } from "../../appointments/appointment-detail";
import { AppointmentsTab } from "./appointments-tab";
import { BillingTab } from "./billing-tab";
import { DiaryTab } from "./diary-tab";
import { ImportDialog } from "./import-dialog";
import { IntakePanel } from "./intake-panel";
import { IntakeSend } from "./intake-send";
import { LabsTab } from "./labs-tab";
import { AllergyForm, CopyPlanForm, FromTemplateForm, HealthForm, MeasurementForm, NoteForm, PatientForm, SaveAsTemplateForm } from "../forms";

export const metadata: Metadata = { title: "Patient" };

const TABS = ["overview", "plans", "diary", "measurements", "labs", "notes", "health", "appointments", "billing"] as const;
const ASSISTANT_TABS = ["appointments", "billing"] as const;
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Active",
  very_active: "Very active",
};
const STATUS = { active: { label: "Active", tone: "green" }, draft: { label: "Draft", tone: "amber" }, archived: { label: "Previous", tone: "gray" } } as const;

export default async function PatientPage({ params, searchParams }: PageProps<"/dashboard/patients/[id]">) {
  const { membership } = await requireStaff();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const [{ data: patient }, { data: clinical }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, email, phone, date_of_birth, sex, user_id, dietitian_id, archived_at, created_at, profiles!patients_dietitian_id_fkey(full_name, email)")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("can_see_clinical", { p_patient_id: id }),
  ]);
  if (!patient) notFound();

  const today = todayIn(membership.timezone);
  const age = ageOn(patient.date_of_birth, today);
  const dietitian = patient.profiles?.full_name || patient.profiles?.email;
  const firstName = patient.full_name.split(/\s+/)[0];
  const appUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3300"}/signup?email=${encodeURIComponent(patient.email ?? "")}`;

  const header = (
    <div className="space-y-4">
      <Link href="/dashboard/patients" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Patients
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ink text-lg font-semibold text-brand">
            {patient.full_name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
            <p className="text-sm text-muted">
              {[age !== null ? `${age} years` : null, patient.sex === "female" ? "Female" : patient.sex === "male" ? "Male" : null, patient.phone, patient.email]
                .filter(Boolean)
                .join(" · ") || "No details yet"}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {patient.archived_at && <Badge tone="gray">Archived</Badge>}
              {dietitian ? <Badge tone="gray">Dietitian: {dietitian}</Badge> : <Badge tone="amber">No dietitian assigned</Badge>}
              {patient.user_id ? <Badge tone="green">Uses the app</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!patient.user_id && patient.email && (
            <Dialog label="Invite to app" icon={<Smartphone className="size-4" />} variant="secondary" title="Invite to the patient app" description="They sign up with this email and their file is linked automatically.">
              <div className="space-y-3">
                {patient.phone && <SendWhatsApp action={sendAppInviteAction.bind(null, patient.id, appUrl)} />}
                <InviteShare url={appUrl} message={patientInviteMessage(firstName, membership.practiceName, appUrl)} />
              </div>
            </Dialog>
          )}
          {clinical && (
            <Link href={`/dashboard/patients/${patient.id}/consult`} className={buttonClass("primary")}>
              <Stethoscope className="size-4" /> Start consultation
            </Link>
          )}
          <Dialog label="Edit details" variant="secondary" title="Edit patient">
            <PatientForm action={updatePatient.bind(null, patient.id)} patient={patient} />
          </Dialog>
        </div>
      </div>
    </div>
  );

  const billing = membership.role !== "dietitian";
  const apptParam = typeof sp.appt === "string" ? sp.appt : null;

  if (!clinical) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="flex items-start gap-3 p-5">
          <Lock className="mt-0.5 size-5 shrink-0 text-muted" />
          <p className="text-sm text-muted">The clinical file (plans, diary, measurements, notes, health history) is visible to the assigned dietitian and the practice owner only.</p>
        </Card>
        <PageTabs
          instant
          base={`/dashboard/patients/${id}`}
          active={ASSISTANT_TABS.includes(sp.tab as (typeof ASSISTANT_TABS)[number]) ? (sp.tab as string) : "appointments"}
          tabs={[
            { id: "appointments", label: "Appointments" },
            ...(billing ? [{ id: "billing", label: "Billing" }] : []),
          ]}
        />
        <TabPanel id="appointments" tabs={ASSISTANT_TABS}>
          <AppointmentsTab patientId={id} patientName={patient.full_name} membership={membership} />
        </TabPanel>
        {billing && (
          <TabPanel id="billing" tabs={ASSISTANT_TABS}>
            <BillingTab patientId={id} membership={membership} firstName={firstName} />
          </TabPanel>
        )}
        {apptParam && <AppointmentDetail id={apptParam} membership={membership} />}
      </div>
    );
  }

  const [{ data: health }, { data: allergies }, { data: measurements }, { data: notes }, { data: plans }, { data: templates }, messagesOn, { data: others }] = await Promise.all([
    supabase.from("patient_health").select("*").eq("patient_id", id).maybeSingle(),
    supabase.from("patient_allergies").select("*").eq("patient_id", id).order("created_at"),
    supabase.from("measurements").select("*").eq("patient_id", id).order("measured_on").order("created_at"),
    supabase.from("consultation_notes").select("*, profiles(full_name)").eq("patient_id", id).order("noted_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("meal_plans").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("templates").select("id, name, kind, content").order("is_favorite", { ascending: false }).order("name"),
    hasFeature(membership.practiceId, "messages"),
    // Other patients, for "Copy to another patient".
    supabase.from("patients").select("id, full_name").eq("practice_id", membership.practiceId).is("archived_at", null).neq("id", id).order("full_name").limit(500),
  ]);

  // AI reading of photos and scans: switched on by the platform admin, and needs the server key.
  const aiImport = (await hasFeature(membership.practiceId, "ai_document_import")) && aiConfigured();
  const allergenIds = (allergies ?? []).map((a) => a.allergen);
  const weights = (measurements ?? []).filter((m) => m.weight_kg !== null);
  const latest = weights.at(-1);
  const first = weights[0];
  const active = plans?.find((p) => p.status === "active");
  const latestNote = notes?.[0];
  const planParam = typeof sp.plan === "string" ? sp.plan : null;
  const openPlan = planParam && planParam !== "new" ? plans?.find((p) => p.id === planParam) : null;
  const totalsOf = (c: unknown) => (c as SavedContent | null)?.totals;
  // The patient's numbers, for suggested targets in the builder and the closest templates.
  const profile: TargetProfile = {
    firstName,
    weightKg: latest ? Number(latest.weight_kg) : null,
    heightCm: health?.height_cm ? Number(health.height_cm) : null,
    age,
    sex: patient.sex,
    activity: health?.activity_level ?? null,
    goalText: health?.goal ?? null,
  };
  const suggested = suggestTargets(profile, guessGoal(health?.goal));

  return (
    <div className="space-y-6">
      {header}

      {allergies && allergies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="size-4" />
          <span className="font-medium">Allergies and intolerances:</span>
          {allergies.map((a) => (
            <span key={a.id}>
              {a.allergen === "other" ? a.label : ALLERGEN_LABELS[a.allergen]} ({a.kind === "intolerance" ? "intolerance" : a.severity})
            </span>
          ))}
        </div>
      )}

      <PageTabs
        instant
        base={`/dashboard/patients/${id}`}
        active={TABS.includes(sp.tab as (typeof TABS)[number]) ? (sp.tab as string) : "overview"}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "plans", label: "Meal plans", count: plans?.filter((p) => p.status === "draft").length },
          { id: "diary", label: "Diary" },
          { id: "measurements", label: "Measurements" },
          { id: "labs", label: "Labs" },
          { id: "notes", label: "Notes" },
          { id: "health", label: "Health" },
          { id: "appointments", label: "Appointments" },
          ...(billing ? [{ id: "billing", label: "Billing" }] : []),
        ]}
      />

      {/* Overview */}
      <TabPanel id="overview" tabs={TABS}>
        {/* The things a consultation usually needs, without hunting through tabs. */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={`/dashboard/patients/${id}?tab=plans&plan=${active ? active.id : "new"}`} scroll={false} className={buttonClass("primary")}>
            <NotebookTabs className="size-4" /> {active ? "Open meal plan" : "New meal plan"}
          </Link>
          <Dialog label="Add weight" icon={<Scale className="size-4" />} variant="secondary" title="Add measurement">
            <MeasurementForm action={addMeasurement.bind(null, id)} today={today} />
          </Dialog>
          <Dialog label="Add note" icon={<PenLine className="size-4" />} variant="secondary" title="Consultation note" size="lg">
            <NoteForm action={saveNote.bind(null, id, null)} today={today} />
          </Dialog>
          <Link href={`/dashboard/patients/${id}?tab=appointments`} scroll={false} className={buttonClass("secondary")}>
            <CalendarPlus className="size-4" /> Book
          </Link>
          {!health?.medical_history && !health?.nutrition_history && (
            <IntakeSend patientId={id} firstName={firstName} practiceName={membership.practiceName} phone={patient.phone} />
          )}
          {patient.user_id && messagesOn && (
            <Link href={`/dashboard/messages?p=${id}`} className={buttonClass("secondary")}>
              <MessageCircle className="size-4" /> Message
            </Link>
          )}
        </div>
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Weight" value={latest ? `${num(latest.weight_kg, 1)} kg` : "-"} hint={latest ? formatDate(latest.measured_on) : "Not measured yet"} />
          <Stat
            label="Change"
            value={latest && first && latest !== first ? `${Number(latest.weight_kg) - Number(first.weight_kg) > 0 ? "+" : ""}${num(Number(latest.weight_kg) - Number(first.weight_kg), 1)} kg` : "-"}
            hint={first && latest !== first ? `since ${formatDate(first.measured_on)}` : "Needs two weigh-ins"}
          />
          <Stat label="BMI" value={num(bmi(Number(latest?.weight_kg), Number(health?.height_cm)), 1)} hint={health?.height_cm ? `${num(health.height_cm)} cm tall` : "Add height in Health"} />
          <Stat
            label={health?.target_weight_kg ? "Target weight" : "Goal"}
            value={health?.target_weight_kg ? `${num(health.target_weight_kg, 1)} kg` : health?.goal ? "" : "-"}
            hint={
              health?.target_weight_kg
                ? (projectionText(projectGoal(weights.map((w) => ({ date: w.measured_on, kg: Number(w.weight_kg) })), Number(health.target_weight_kg)), Number(health.target_weight_kg)) ?? undefined)
                : (health?.goal ?? "Not set: add a goal or target weight in Health")
            }
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle action={active && <Badge tone="green">Active</Badge>}>Current meal plan</SectionTitle>
            <div className="px-5 pb-5">
              {active ? (
                <div className="space-y-3">
                  <Link href={`/dashboard/patients/${id}?tab=plans&plan=${active.id}`} scroll={false} className="font-medium hover:underline">
                    {active.name}
                  </Link>
                  {totalsOf(active.content) && <MacroSummary compact totals={totalsOf(active.content)!} targets={active.targets as Targets} />}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    {plans?.some((p) => p.status === "draft") ? `A draft is waiting. Open it and give it to ${firstName}.` : `${firstName} has no meal plan yet.`}
                  </p>
                  <Link
                    href={`/dashboard/patients/${id}?tab=plans&plan=${plans?.find((p) => p.status === "draft")?.id ?? "new"}`}
                    scroll={false}
                    className={buttonClass("secondary")}
                  >
                    {plans?.some((p) => p.status === "draft") ? "Open the draft" : "Build a plan"}
                  </Link>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <SectionTitle>Latest note</SectionTitle>
            <div className="px-5 pb-5">
              {latestNote ? (
                <div>
                  <p className="text-xs text-muted">{formatDate(latestNote.noted_on)}</p>
                  {latestNote.title && <p className="font-medium">{latestNote.title}</p>}
                  <p className="mt-1 line-clamp-4 text-sm whitespace-pre-line">{latestNote.body}</p>
                </div>
              ) : (
                <Link href={`/dashboard/patients/${id}?tab=notes`} scroll={false} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
                  No consultation notes yet. Add one after the visit.
                </Link>
              )}
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* Plans */}
      <TabPanel id="plans" tabs={TABS}>
        <div className="flex flex-wrap justify-end gap-2">
          <Dialog label="From a template" variant="secondary" title="New plan from a template">
            <FromTemplateForm
              action={planFromTemplate.bind(null, id)}
              templates={(templates ?? []).map((t) => ({ id: t.id, name: t.name, kind: t.kind, kcal: totalsOf(t.content)?.kcal ?? null }))}
              target={suggested ? { kcal: suggested.targets.kcal, firstName } : undefined}
            />
          </Dialog>
          <Link href={`/dashboard/patients/${id}?tab=plans&plan=new`} scroll={false} className={buttonClass("primary")}>
            <Plus className="size-4" /> New plan
          </Link>
        </div>
        <Card className="mt-4">
          {!plans?.length ? (
            <EmptyState>
              <span className="block pt-5">No meal plans yet.</span>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {plans.map((p) => {
                const t = totalsOf(p.content);
                const days = (p.content as SavedContent | null)?.days.length ?? 0;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <Link href={`/dashboard/patients/${id}?tab=plans&plan=${p.id}`} scroll={false} className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium hover:underline">{p.name}</span>
                        <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                      </span>
                      <span className="block text-sm text-muted tabular-nums">
                        {[t ? `${t.kcal} kcal/day` : null, `${days} day${days === 1 ? "" : "s"}`, p.starts_on ? `from ${formatDate(p.starts_on)}` : `created ${formatDate(p.created_at)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                    {p.status === "draft" && (
                      <ActionButton
                        variant="primary"
                        action={activatePlan.bind(null, p.id)}
                        confirm={active ? `Give "${p.name}" to ${firstName}? "${active.name}" moves to previous plans.` : undefined}
                      >
                        {`Give to ${firstName}`}
                      </ActionButton>
                    )}
                    <RowMenu
                      items={[
                        { kind: "link", label: p.status === "archived" ? "View" : "Open", href: `/dashboard/patients/${id}?tab=plans&plan=${p.id}` },
                        p.status === "draft" && {
                          kind: "action",
                          label: "Give to patient",
                          action: activatePlan.bind(null, p.id),
                          confirm: active ? `Give "${p.name}" to ${firstName}? "${active.name}" moves to previous plans.` : undefined,
                        },
                        p.status === "active" && { kind: "action", label: "End this plan", action: archivePlan.bind(null, p.id), confirm: `End "${p.name}"? It stays in previous plans.` },
                        p.status === "archived" && { kind: "action", label: "Give again", action: activatePlan.bind(null, p.id) },
                        { kind: "link", label: "Download PDF", download: true, href: `/api/plans/${p.id}/pdf` },
                        { kind: "link", label: "Print or other language", href: `/print/plan/${p.id}` },
                        p.status !== "draft" && {
                          kind: "action",
                          label: "Send PDF on WhatsApp",
                          action: sendPlanPdfAction.bind(null, p.id),
                          confirm: `Send "${p.name}" as a PDF to ${firstName} on WhatsApp?`,
                        },
                        { kind: "action", label: "Duplicate", action: duplicatePlan.bind(null, p.id) },
                        (others?.length ?? 0) > 0 && {
                          kind: "dialog",
                          label: "Copy to another patient",
                          title: `Copy "${p.name}"`,
                          content: <CopyPlanForm action={copyPlanToPatient.bind(null, p.id)} patients={(others ?? []).map((o) => ({ id: o.id, name: o.full_name }))} />,
                        },
                        {
                          kind: "dialog",
                          label: "Save as template",
                          title: "Save as template",
                          content: <SaveAsTemplateForm action={templateFromPlan.bind(null, p.id)} defaultName={p.name} days={days} />,
                        },
                        p.status === "draft" && { kind: "action", label: "Delete draft", danger: true, action: deleteDraftPlan.bind(null, p.id), confirm: `Delete the draft "${p.name}"?` },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </TabPanel>

      {/* Labs */}
      <TabPanel id="labs" tabs={TABS}>
        <LabsTab
          patientId={id}
          today={today}
          importButton={<ImportDialog patientId={id} firstName={firstName} fullName={patient.full_name} aiEnabled={aiImport} />}
        />
      </TabPanel>

      {/* Measurements */}
      <TabPanel id="measurements" tabs={TABS}>
        <div className="flex flex-wrap justify-end gap-2">
          <ImportDialog patientId={id} firstName={firstName} fullName={patient.full_name} aiEnabled={aiImport} label="Import from device" />
          <Dialog label="Add measurement" icon={<Plus className="size-4" />} title="Add measurement">
            <MeasurementForm action={addMeasurement.bind(null, id)} today={today} />
          </Dialog>
        </div>
        {weights.length > 1 && (
          <Card className="mt-4 p-4">
            <TrendChart title="Weight" unit="kg" points={weights.map((m) => ({ date: m.measured_on, value: Number(m.weight_kg) }))} />
          </Card>
        )}
        <Card className="mt-4 overflow-x-auto">
          {!measurements?.length ? (
            <EmptyState>
              <span className="block pt-5">No measurements yet. Device imports (InBody, Tanita, Withings) will land here too.</span>
            </EmptyState>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  {["Date", "Weight", "Body fat", "Muscle", "Water", "Visceral", "Waist", "Hip", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {[...measurements].reverse().map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      {formatDate(m.measured_on)}
                      {m.notes && <span className="block text-xs text-muted">{m.notes}</span>}
                    </td>
                    <td className="px-4 py-3">{m.weight_kg !== null ? `${num(m.weight_kg, 1)} kg` : "-"}</td>
                    <td className="px-4 py-3">{m.body_fat_pct !== null ? `${num(m.body_fat_pct, 1)}%` : "-"}</td>
                    <td className="px-4 py-3">{m.muscle_mass_kg !== null ? `${num(m.muscle_mass_kg, 1)} kg` : "-"}</td>
                    <td className="px-4 py-3">{m.body_water_pct !== null ? `${num(m.body_water_pct, 1)}%` : "-"}</td>
                    <td className="px-4 py-3">{num(m.visceral_fat, 1)}</td>
                    <td className="px-4 py-3">{m.waist_cm !== null ? `${num(m.waist_cm, 1)} cm` : "-"}</td>
                    <td className="px-4 py-3">{m.hip_cm !== null ? `${num(m.hip_cm, 1)} cm` : "-"}</td>
                    <td className="px-2 py-2 text-right">
                      <RowMenu items={[{ kind: "action", label: "Delete", danger: true, action: deleteMeasurement.bind(null, m.id), confirm: `Delete the measurement from ${formatDate(m.measured_on)}?` }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </TabPanel>

      {/* Notes */}
      <TabPanel id="notes" tabs={TABS}>
        <div className="flex justify-end">
          <Dialog label="Add note" icon={<Plus className="size-4" />} title="Consultation note" size="lg">
            <NoteForm action={saveNote.bind(null, id, null)} today={today} />
          </Dialog>
        </div>
        <div className="mt-4 space-y-3">
          {!notes?.length ? (
            <Card>
              <EmptyState>
                <span className="block pt-5">No notes yet.</span>
              </EmptyState>
            </Card>
          ) : (
            notes.map((n) => (
              <Card key={n.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">
                      {formatDate(n.noted_on)}
                      {n.profiles?.full_name ? ` · ${n.profiles.full_name}` : ""}
                    </p>
                    {n.title && <p className="font-semibold">{n.title}</p>}
                  </div>
                  <RowMenu
                    items={[
                      { kind: "dialog", label: "Edit", title: "Edit note", size: "lg", content: <NoteForm action={saveNote.bind(null, id, n.id)} today={today} note={n} /> },
                      { kind: "action", label: "Delete", danger: true, action: deleteNote.bind(null, n.id), confirm: "Delete this note?" },
                    ]}
                  />
                </div>
                <p className="mt-2 text-sm whitespace-pre-line">{n.body}</p>
              </Card>
            ))
          )}
        </div>
      </TabPanel>

      {/* Health */}
      <TabPanel id="health" tabs={TABS}>
        <div className="mb-4">
          <IntakePanel patient={patient} practiceName={membership.practiceName} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle
              action={
                <Dialog label="Edit" variant="secondary" triggerClassName="h-8 px-3" title="Health history" size="lg">
                  <HealthForm action={saveHealth.bind(null, id)} health={health} />
                </Dialog>
              }
            >
              Health history
            </SectionTitle>
            <dl className="divide-y divide-line border-t border-line text-sm">
              {(
                [
                  ["Height", health?.height_cm ? `${num(health.height_cm)} cm` : null],
                  ["Target weight", health?.target_weight_kg ? `${num(health.target_weight_kg, 1)} kg` : null],
                  ["Activity", health?.activity_level ? ACTIVITY_LABELS[health.activity_level] : null],
                  ["Goal", health?.goal],
                  ["Medical history", health?.medical_history],
                  ["Medications", health?.medications],
                  ["Nutrition history", health?.nutrition_history],
                  ["Lifestyle", health?.lifestyle],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-muted">{label}</dt>
                  <dd className="whitespace-pre-line">{value || <span className="text-muted/60">-</span>}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <SectionTitle
              action={
                <Dialog label="Add" variant="secondary" triggerClassName="h-8 px-3" title="Add allergy or intolerance">
                  <AllergyForm action={addAllergy.bind(null, id)} />
                </Dialog>
              }
            >
              Allergies
            </SectionTitle>
            {!allergies?.length ? (
              <p className="px-5 pb-5 text-sm text-muted">None recorded. Plans warn when a food matches a recorded allergy.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {allergies.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{a.allergen === "other" ? a.label : ALLERGEN_LABELS[a.allergen]}</span>
                      <span className="block text-xs text-muted">
                        {a.kind === "intolerance" ? "Intolerance" : "Allergy"} · {a.severity}
                        {a.notes ? ` · ${a.notes}` : ""}
                      </span>
                    </span>
                    <RowMenu items={[{ kind: "action", label: "Remove", danger: true, action: removeAllergy.bind(null, a.id), confirm: "Remove this allergy?" }]} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </TabPanel>

      {/* Diary */}
      <TabPanel id="diary" tabs={TABS}>
        <DiaryTab patientId={id} timeZone={membership.timezone} targets={active?.targets as Targets | undefined} />
      </TabPanel>

      <TabPanel id="appointments" tabs={TABS}>
        <AppointmentsTab patientId={id} patientName={patient.full_name} membership={membership} />
      </TabPanel>

      {billing && (
        <TabPanel id="billing" tabs={TABS}>
          <BillingTab patientId={id} membership={membership} firstName={firstName} />
        </TabPanel>
      )}

      {apptParam && <AppointmentDetail id={apptParam} membership={membership} />}

      {planParam && (planParam === "new" || openPlan) && (
        <RouteModal param="plan" size="xl" title={openPlan ? openPlan.name : "New meal plan"} description={openPlan?.status === "archived" ? "A previous plan. It can't be edited; give it again or save it as a template." : patient.full_name}>
          <PlanBuilder
            mode="plan"
            draftKey={`plan:${id}:${openPlan?.id ?? "new"}`}
            closeParams={["plan"]}
            readOnly={openPlan?.status === "archived"}
            patientAllergies={allergenIds}
            initialMeta={
              openPlan
                ? {
                    name: openPlan.name,
                    startsOn: openPlan.starts_on ?? "",
                    endsOn: openPlan.ends_on ?? "",
                    notes: openPlan.notes ?? "",
                    targets: openPlan.targets as Targets,
                  }
                : { name: `${firstName}'s plan`, targets: suggested?.targets ?? {} }
            }
            initialDays={openPlan ? contentToDays(openPlan.content as SavedContent) : []}
            onSave={savePlanAction.bind(null, id, openPlan?.id ?? null)}
            profile={profile}
            give={!openPlan || openPlan.status === "draft" ? { label: `Give to ${firstName}`, replaces: active && active.id !== openPlan?.id ? active.name : null } : undefined}
          />
        </RouteModal>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      {value ? <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p> : <p className="mt-1 text-sm font-medium">{hint}</p>}
      {value && hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}
