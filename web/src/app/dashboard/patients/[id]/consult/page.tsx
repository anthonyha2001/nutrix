import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarPlus, CheckCircle2, NotebookTabs, PenLine, Scale } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { InlineForm } from "@/components/dialog";
import { MacroSummary } from "@/components/macro-summary";
import { PatientSummaryCard } from "@/components/patient-summary";
import { TrendChart } from "@/components/trend-chart";
import { Badge, buttonClass, Card } from "@/components/ui";
import { ageOn, todayIn } from "@/lib/format";
import { ALLERGEN_LABELS, type SavedContent, type Targets } from "@/lib/nutrition";
import { patientSummary } from "@/lib/patient-summary";
import { clinicians } from "@/lib/practice";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, APPOINTMENT_STATUS, formatWhen, isoToLocal, localToIso } from "@/lib/time";
import { addAppointmentNote, bookAppointment, markAttendance } from "../../../appointments/actions";
import { BookForm } from "../../../appointments/forms";
import { PackageRenewal } from "../../../billing/package-renewal";
import { addMeasurement, saveNote } from "../../actions";
import { MeasurementForm, NoteForm } from "../../forms";

export const metadata: Metadata = { title: "Consultation" };

// One screen for the visit: what happened since last time on the left, and
// what to do now (weigh, note, plan, next visit, attendance) on the right.
// Opened from the patient file or an appointment (?appt=<id>).
export default async function ConsultPage({ params, searchParams }: PageProps<"/dashboard/patients/[id]/consult">) {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const apptId = typeof sp.appt === "string" ? sp.appt : null;
  const supabase = await createClient();
  const tz = membership.timezone;
  const today = todayIn(tz);

  const [{ data: patient }, { data: clinical }] = await Promise.all([
    supabase.from("patients").select("id, full_name, date_of_birth, sex, phone").eq("id", id).maybeSingle(),
    supabase.rpc("can_see_clinical", { p_patient_id: id }),
  ]);
  if (!patient) notFound();
  if (!clinical) redirect(`/dashboard/patients/${id}`);

  const [summary, { data: weights }, { data: plan }, { data: allergies }, { data: appt }, { data: next }, { data: services }, team] = await Promise.all([
    patientSummary(id, tz),
    supabase.from("measurements").select("measured_on, weight_kg").eq("patient_id", id).not("weight_kg", "is", null).order("measured_on"),
    supabase.from("meal_plans").select("id, name, targets, content").eq("patient_id", id).eq("status", "active").maybeSingle(),
    supabase.from("patient_allergies").select("allergen, label, kind, severity").eq("patient_id", id),
    apptId ? supabase.from("appointments").select("id, starts_at, status").eq("id", apptId).eq("patient_id", id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("appointments")
      .select("starts_at")
      .eq("patient_id", id)
      .in("status", ["confirmed", "requested"])
      .gte("starts_at", localToIso(addDays(today, 1), "00:00", tz))
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("services").select("id, name, duration_min, price_usd").eq("practice_id", membership.practiceId).is("archived_at", null).order("name"),
    membership.role !== "dietitian" ? clinicians(membership.practiceId) : Promise.resolve([]),
  ]);

  const firstName = patient.full_name.split(/\s+/)[0];
  const age = ageOn(patient.date_of_birth, today);
  const totals = (plan?.content as SavedContent | null)?.totals;
  const canMark = appt && (appt.status === "confirmed" || appt.status === "requested") && isoToLocal(appt.starts_at, tz).date <= today;
  const noteAction = appt ? addAppointmentNote.bind(null, id, appt.id) : saveNote.bind(null, id, null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/dashboard/patients/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Patient file
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Consultation: {patient.full_name}</h1>
          <p className="text-sm text-muted">
            {[age !== null ? `${age} years` : null, patient.sex === "female" ? "Female" : patient.sex === "male" ? "Male" : null, appt ? formatWhen(appt.starts_at, tz) : "Today"]
              .filter(Boolean)
              .join(" · ")}
            {appt && <span className="ml-2" />}
            {appt && <Badge tone={APPOINTMENT_STATUS[appt.status].tone}>{APPOINTMENT_STATUS[appt.status].label}</Badge>}
          </p>
        </div>
        {canMark && appt && (
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="primary" action={markAttendance.bind(null, appt.id, true)}>
              <CheckCircle2 className="size-4" /> Mark attended
            </ActionButton>
          </div>
        )}
      </div>

      <PackageRenewal patientId={id} firstName={firstName} membership={membership} />

      {allergies && allergies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="size-4" />
          <span className="font-medium">Allergies and intolerances:</span>
          {allergies.map((a, i) => (
            <span key={i}>
              {a.allergen === "other" ? a.label : ALLERGEN_LABELS[a.allergen]} ({a.kind === "intolerance" ? "intolerance" : a.severity})
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Since last time */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <PatientSummaryCard s={summary} />
          {weights && weights.length > 1 && (
            <Card className="p-4">
              <TrendChart title="Weight" unit="kg" points={weights.map((m) => ({ date: m.measured_on, value: Number(m.weight_kg) }))} />
            </Card>
          )}
        </div>

        {/* Now */}
        <div className="space-y-4">
          <Step icon={<Scale className="size-4" />} title="Weigh-in">
            <InlineForm>
              <MeasurementForm action={addMeasurement.bind(null, id)} today={today} />
            </InlineForm>
          </Step>

          <Step icon={<PenLine className="size-4" />} title="Consultation note" hint={appt ? "Saved with this appointment." : undefined}>
            <InlineForm>
              <NoteForm action={noteAction} today={today} />
            </InlineForm>
          </Step>

          <Step icon={<NotebookTabs className="size-4" />} title="Meal plan">
            {plan ? (
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium">{plan.name}</span> <Badge tone="green">Active</Badge>
                </p>
                {totals && <MacroSummary compact totals={totals} targets={plan.targets as Targets} />}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/patients/${id}?tab=plans&plan=${plan.id}`} className={buttonClass("secondary")}>
                    Adjust the plan
                  </Link>
                  <Link href={`/dashboard/patients/${id}?tab=plans&plan=new`} className={buttonClass("ghost")}>
                    Start a new one
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted">{firstName} has no active plan. Targets are suggested from today&apos;s numbers when you start one.</p>
                <Link href={`/dashboard/patients/${id}?tab=plans&plan=new`} className={buttonClass("primary")}>
                  Build a plan
                </Link>
              </div>
            )}
          </Step>

          <Step icon={<CalendarPlus className="size-4" />} title="Next visit" hint={next ? `Already booked: ${formatWhen(next.starts_at, tz)}.` : undefined}>
            <InlineForm>
              <BookForm
                action={bookAppointment}
                patients={[{ id, name: patient.full_name }]}
                services={(services ?? []).map((s) => ({ ...s, price_usd: Number(s.price_usd) }))}
                dietitians={team}
                defaults={{ date: addDays(today, 14), time: appt ? isoToLocal(appt.starts_at, tz).time : "10:00", patientId: id }}
              />
            </InlineForm>
          </Step>
        </div>
      </div>
    </div>
  );
}

function Step({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-canvas">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}
