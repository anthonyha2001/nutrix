import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Check, ChevronRight, Plus, Video } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, buttonClass, Card, PageHeader, SectionTitle } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { usd } from "@/lib/money";
import { round } from "@/lib/nutrition";
import { clinicians } from "@/lib/practice";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, APPOINTMENT_STATUS, dayLabel, formatTime, localToIso } from "@/lib/time";
import { createPatient } from "./patients/actions";
import { PatientForm } from "./patients/forms";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { viewer, membership } = await requireStaff();
  const tz = membership.timezone;
  const today = todayIn(tz);
  const clinical = membership.role !== "assistant";
  const billing = membership.role !== "dietitian";
  const owner = membership.role === "owner";
  const canAssign = membership.role !== "dietitian";
  const supabase = await createClient();

  // Row-level security scopes everything: a dietitian sees their own patients.
  const [{ count: activePatients }, { data: todays }, { count: requests }, { data: diary }, { data: payments }, { data: balances }, setup, team] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("practice_id", membership.practiceId).is("archived_at", null),
    supabase
      .from("appointments")
      .select("id, starts_at, status, online, patient_id, patients(full_name), services(name)")
      .eq("practice_id", membership.practiceId)
      .gte("starts_at", localToIso(today, "00:00", tz))
      .lt("starts_at", localToIso(addDays(today, 1), "00:00", tz))
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("practice_id", membership.practiceId).eq("status", "requested"),
    clinical
      ? supabase.from("diary_entries").select("patient_id, eaten_on, kcal, created_at, patients(full_name)").gte("eaten_on", addDays(today, -2)).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    billing ? supabase.from("payments").select("amount_usd, paid_at").eq("practice_id", membership.practiceId).gte("paid_at", localToIso(`${today.slice(0, 7)}-01`, "00:00", tz)) : Promise.resolve({ data: [] }),
    billing ? supabase.from("invoice_balances").select("due_usd").eq("practice_id", membership.practiceId).gt("due_usd", 0) : Promise.resolve({ data: [] }),
    clinical ? setupProgress(membership.practiceId, owner) : Promise.resolve(null),
    canAssign ? clinicians(membership.practiceId) : Promise.resolve([]),
  ]);

  // Latest diary activity, one line per patient and day.
  const activity = new Map<string, { name: string; day: string; kcal: number; items: number; at: string; patientId: string }>();
  for (const e of diary ?? []) {
    const k = `${e.patient_id}|${e.eaten_on}`;
    const a = activity.get(k) ?? { name: e.patients?.full_name ?? "Patient", day: e.eaten_on, kcal: 0, items: 0, at: e.created_at, patientId: e.patient_id };
    a.kcal += Number(e.kcal);
    a.items++;
    activity.set(k, a);
  }
  const revenue = (payments ?? []).reduce((a, p) => a + Number(p.amount_usd), 0);
  const outstanding = (balances ?? []).reduce((a, b) => a + Number(b.due_usd), 0);
  const firstName = (viewer.fullName || "").split(" ")[0];

  const stats = [
    { label: "Active patients", value: String(activePatients ?? 0), href: "/dashboard/patients" },
    { label: "Appointments today", value: String(todays?.length ?? 0), href: "/dashboard/appointments" },
    { label: "Requests to confirm", value: String(requests ?? 0), href: "/dashboard/appointments?tab=requests" },
    billing
      ? { label: "Collected this month", value: usd(revenue), href: "/dashboard/billing", hint: outstanding > 0 ? `${usd(outstanding)} outstanding` : undefined }
      : { label: "Patients logging", value: String(new Set([...activity.values()].map((a) => a.patientId)).size), href: "/dashboard/patients", hint: "in the last 3 days" },
  ];

  // First steps for a new practice. The card disappears once all are done.
  const steps = setup
    ? [
        { label: "Add your first patient", done: setup.patients > 0, href: "/dashboard/patients", hint: "Their file holds plans, measurements, notes and health history." },
        { label: "Give a patient their meal plan", done: setup.plans > 0, href: "/dashboard/patients", hint: "Open a patient, build a plan, then press \"Give to\" with their name." },
        { label: "Invite a patient to the app", done: setup.onApp > 0, href: "/dashboard/patients", hint: "From the patient's file. They see their plan and log meals on their phone." },
        ...(owner
          ? [
              { label: "Set your consultation prices", done: setup.services > 0, href: "/dashboard/billing?tab=catalogue", hint: "Services and packages, so visits are billed for you." },
              { label: "Invite your team (optional)", done: setup.team > 1, href: "/dashboard/team", hint: "Dietitians and assistants, each with the right access." },
            ]
          : []),
      ]
    : [];
  const stepsDone = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Good day, ${firstName}` : "Overview"}
        description={membership.practiceName}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/appointments" className={buttonClass("secondary")}>
              <CalendarPlus className="size-4" /> Book
            </Link>
            <Dialog label="Add patient" icon={<Plus className="size-4" />} title="Add patient">
              <PatientForm action={createPatient} dietitians={canAssign ? team : undefined} defaultDietitian={owner ? viewer.id : undefined} />
            </Dialog>
          </div>
        }
      />

      {steps.length > 0 && stepsDone < steps.length && (
        <Card>
          <SectionTitle action={<span className="text-sm text-muted tabular-nums">{stepsDone} of {steps.length} done</span>}>Getting started</SectionTitle>
          <div className="mx-5 mb-3 h-1.5 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={stepsDone}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${s.done ? "border-brand bg-brand text-ink" : "border-line"}`}>
                    {s.done && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${s.done ? "text-muted line-through" : ""}`}>{s.label}</span>
                    {!s.done && <span className="block text-sm text-muted">{s.hint}</span>}
                  </span>
                  {!s.done && <ChevronRight className="size-4 shrink-0 text-muted" />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border border-line bg-surface p-4 transition hover:border-ink/20">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            {s.hint && <p className="text-xs text-muted">{s.hint}</p>}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle action={<Link href="/dashboard/appointments" className="text-sm text-muted hover:text-ink">Calendar</Link>}>Today</SectionTitle>
          {!todays?.length ? (
            <p className="px-5 pb-5 text-sm text-muted">No appointments today.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {todays.map((a) => (
                <li key={a.id}>
                  <Link href={`/dashboard/appointments?appt=${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                    <span className="w-12 text-sm font-semibold tabular-nums">{formatTime(a.starts_at, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.patients?.full_name}</span>
                      <span className="block truncate text-sm text-muted">{a.services?.name ?? "Consultation"}</span>
                    </span>
                    {a.online && <Video className="size-4 text-muted" aria-label="Online" />}
                    <Badge tone={APPOINTMENT_STATUS[a.status].tone}>{APPOINTMENT_STATUS[a.status].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {clinical ? (
          <Card>
            <SectionTitle>Recent food diary activity</SectionTitle>
            {!activity.size ? (
              <p className="px-5 pb-5 text-sm text-muted">No patient has logged meals in the last 3 days.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {[...activity.values()].slice(0, 8).map((a) => (
                  <li key={`${a.patientId}${a.day}`}>
                    <Link href={`/dashboard/patients/${a.patientId}?tab=diary`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.name}</span>
                        <span className="block text-sm text-muted">
                          {a.day === today ? "Today" : a.day === addDays(today, -1) ? "Yesterday" : dayLabel(a.day)} · {a.items} item{a.items === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="text-sm font-medium tabular-nums">{round(a.kcal)} kcal</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card>
            <SectionTitle>Billing</SectionTitle>
            <p className="px-5 pb-5 text-sm text-muted">{outstanding > 0 ? `${usd(outstanding)} is outstanding across patients.` : "Nothing outstanding."}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// How far a new practice has got with its first steps. Row-level security
// scopes the counts, so a dietitian's checklist reflects their own patients.
async function setupProgress(practiceId: string, owner: boolean) {
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [patients, plans, onApp, services, team] = await Promise.all([
    count(supabase.from("patients").select("*", { count: "exact", head: true }).eq("practice_id", practiceId)),
    count(supabase.from("meal_plans").select("*", { count: "exact", head: true }).neq("status", "draft")),
    count(supabase.from("patients").select("*", { count: "exact", head: true }).eq("practice_id", practiceId).not("user_id", "is", null)),
    owner ? count(supabase.from("services").select("*", { count: "exact", head: true }).eq("practice_id", practiceId)) : Promise.resolve(0),
    owner ? count(supabase.from("practice_users").select("*", { count: "exact", head: true }).eq("practice_id", practiceId)) : Promise.resolve(0),
  ]);
  return { patients, plans, onApp, services, team };
}
