import Link from "next/link";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Card, EmptyState } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { clinicians } from "@/lib/practice";
import type { StaffMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { APPOINTMENT_STATUS, formatWhen } from "@/lib/time";
import { bookAppointment } from "../../appointments/actions";
import { BookForm } from "../../appointments/forms";

export async function AppointmentsTab({ patientId, patientName, membership }: { patientId: string; patientName: string; membership: StaffMembership }) {
  const supabase = await createClient();
  const [{ data: appts }, { data: services }, team] = await Promise.all([
    supabase.from("appointments").select("id, starts_at, status, online, services(name)").eq("patient_id", patientId).order("starts_at", { ascending: false }).limit(100),
    supabase.from("services").select("id, name, duration_min, price_usd").eq("practice_id", membership.practiceId).is("archived_at", null).order("name"),
    membership.role !== "dietitian" ? clinicians(membership.practiceId) : Promise.resolve([]),
  ]);
  const now = new Date().toISOString();
  const upcoming = (appts ?? []).filter((a) => a.starts_at >= now && (a.status === "confirmed" || a.status === "requested")).reverse();
  const past = (appts ?? []).filter((a) => !upcoming.includes(a));
  const attended = past.filter((a) => a.status === "completed").length;
  const missed = past.filter((a) => a.status === "no_show").length;

  const row = (a: NonNullable<typeof appts>[number]) => (
    <li key={a.id}>
      <Link href={`/dashboard/patients/${patientId}?tab=appointments&appt=${a.id}`} scroll={false} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
        <span className="min-w-0 flex-1">
          <span className="block font-medium tabular-nums">{formatWhen(a.starts_at, membership.timezone)}</span>
          <span className="block text-sm text-muted">{[a.services?.name, a.online ? "Online" : null].filter(Boolean).join(" · ") || "Consultation"}</span>
        </span>
        <Badge tone={APPOINTMENT_STATUS[a.status].tone}>{APPOINTMENT_STATUS[a.status].label}</Badge>
      </Link>
    </li>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {attended} attended{missed ? ` · ${missed} missed` : ""}
        </p>
        <Dialog label="Book" icon={<Plus className="size-4" />} title={`Book ${patientName}`}>
          <BookForm
            action={bookAppointment}
            patients={[{ id: patientId, name: patientName }]}
            services={(services ?? []).map((s) => ({ ...s, price_usd: Number(s.price_usd) }))}
            dietitians={team}
            defaults={{ date: todayIn(membership.timezone), time: "10:00", patientId }}
          />
        </Dialog>
      </div>
      <Card className="mt-4">
        <p className="px-5 pt-4 pb-2 text-sm font-semibold">Upcoming</p>
        {upcoming.length ? <ul className="divide-y divide-line border-t border-line">{upcoming.map(row)}</ul> : <p className="px-5 pb-4 text-sm text-muted">Nothing booked.</p>}
      </Card>
      <Card className="mt-4">
        <p className="px-5 pt-4 pb-2 text-sm font-semibold">History</p>
        {past.length ? (
          <ul className="divide-y divide-line border-t border-line">{past.map(row)}</ul>
        ) : (
          <EmptyState>No past appointments.</EmptyState>
        )}
      </Card>
    </>
  );
}
