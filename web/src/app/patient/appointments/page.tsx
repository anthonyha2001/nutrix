import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
import { Badge, Card } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, APPOINTMENT_STATUS, formatWhen } from "@/lib/time";
import { cancelMyAppointment } from "../actions";
import { RequestForm } from "../widgets";

export const metadata: Metadata = { title: "Appointments" };

export default async function PatientAppointmentsPage() {
  const { link } = await requirePatient();
  const booking = await hasFeature(link.practiceId, "patient_booking");
  const { data: appts } = await (await createClient())
    .from("appointments")
    .select("id, starts_at, status, online, services(name)")
    .eq("patient_id", link.patientId)
    .order("starts_at", { ascending: false })
    .limit(50);
  const now = new Date().toISOString();
  const upcoming = (appts ?? []).filter((a) => a.starts_at >= now && (a.status === "requested" || a.status === "confirmed")).reverse();
  const past = (appts ?? []).filter((a) => !upcoming.includes(a));

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
      <Card className="rounded-2xl">
        <p className="px-5 pt-4 pb-2 font-semibold">Upcoming</p>
        {upcoming.length ? (
          <ul className="divide-y divide-line px-5 pb-3">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{formatWhen(a.starts_at, link.timezone)}</span>
                  <span className="block text-sm text-muted">{[a.services?.name, a.online ? "Online" : null].filter(Boolean).join(" · ") || "Consultation"}</span>
                </span>
                <Badge tone={APPOINTMENT_STATUS[a.status].tone}>{a.status === "requested" ? "Waiting for confirmation" : "Confirmed"}</Badge>
                <ActionButton action={cancelMyAppointment.bind(null, a.id)} variant="ghost" className="h-8 px-3 text-xs" confirm="Cancel this appointment?" danger>
                  Cancel
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-4 text-sm text-muted">Nothing booked.</p>
        )}
      </Card>
      {booking && (
      <Card className="rounded-2xl p-5">
        <p className="mb-1 font-semibold">Ask for an appointment</p>
        <p className="mb-4 text-sm text-muted">Choose a time that suits you. {link.practiceName} will confirm it or suggest another.</p>
        <RequestForm tomorrow={addDays(todayIn(link.timezone), 1)} />
      </Card>
      )}
      {past.length > 0 && (
        <Card className="rounded-2xl">
          <p className="px-5 pt-4 pb-2 font-semibold">Past</p>
          <ul className="divide-y divide-line px-5 pb-3">
            {past.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{formatWhen(a.starts_at, link.timezone)}</span>
                <Badge tone={APPOINTMENT_STATUS[a.status].tone}>{APPOINTMENT_STATUS[a.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
