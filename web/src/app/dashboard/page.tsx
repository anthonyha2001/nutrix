import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Video } from "lucide-react";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { FOLLOW_UP_RULES } from "@/lib/modules";
import { usd } from "@/lib/money";
import { round } from "@/lib/nutrition";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, APPOINTMENT_STATUS, dayLabel, formatTime, localToIso } from "@/lib/time";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { viewer, membership } = await requireStaff();
  const tz = membership.timezone;
  const today = todayIn(tz);
  const clinical = membership.role !== "assistant";
  const billing = membership.role !== "dietitian";
  const supabase = await createClient();

  // Row-level security scopes everything: a dietitian sees their own patients.
  const [{ count: activePatients }, { data: todays }, { count: requests }, { data: diary }, { data: payments }, { data: balances }] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <PageHeader title={firstName ? `Good day, ${firstName}` : "Overview"} description={membership.practiceName} />

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

      <Card>
        <SectionTitle action={<Badge tone="gray">Phase 3</Badge>}>Daily briefing</SectionTitle>
        <div className="px-5 pb-5">
          <p className="text-sm text-muted">Coming next: each morning Nutrix will list the patients who need you, and why. You choose which situations count.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FOLLOW_UP_RULES.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs text-muted">
                <BellRing className="size-3" />
                {r.label}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
