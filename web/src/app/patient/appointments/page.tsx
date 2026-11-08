import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
import { Badge, Card } from "@/components/ui";
import { hasFeature } from "@/lib/features";
import { todayIn } from "@/lib/format";
import { formatWhenIn } from "@/lib/patient-i18n";
import { patientText } from "@/lib/patient-lang";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, APPOINTMENT_STATUS } from "@/lib/time";
import { cancelMyAppointment } from "../actions";
import { RequestForm } from "../widgets";

export const metadata: Metadata = { title: "Appointments" };

export default async function PatientAppointmentsPage() {
  const { viewer, link } = await requirePatient();
  const { lang, t } = await patientText(viewer);
  const [booking, { data: appts }] = await Promise.all([
    hasFeature(link.practiceId, "patient_booking"),
    (await createClient()).from("appointments").select("id, starts_at, status, online, services(name)").eq("patient_id", link.patientId).order("starts_at", { ascending: false }).limit(50),
  ]);
  const now = new Date().toISOString();
  const upcoming = (appts ?? []).filter((a) => a.starts_at >= now && (a.status === "requested" || a.status === "confirmed")).reverse();
  const past = (appts ?? []).filter((a) => !upcoming.includes(a));
  const a = t.appointments;

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
      <Card className="rounded-2xl">
        <p className="px-5 pt-4 pb-2 font-semibold">{a.upcoming}</p>
        {upcoming.length ? (
          <ul className="divide-y divide-line px-5 pb-3">
            {upcoming.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{formatWhenIn(x.starts_at, link.timezone, lang)}</span>
                  <span className="block text-sm text-muted">
                    {[x.services?.name ? <bdi key="s">{x.services.name}</bdi> : a.consultation, x.online ? ` · ${t.today.online}` : null]}
                  </span>
                </span>
                <Badge tone={APPOINTMENT_STATUS[x.status].tone}>{x.status === "requested" ? a.waiting : a.confirmed}</Badge>
                <ActionButton action={cancelMyAppointment.bind(null, x.id)} variant="ghost" className="h-8 px-3 text-xs" confirm={a.cancelConfirm} danger>
                  {a.cancel}
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-4 text-sm text-muted">{a.nothing}</p>
        )}
      </Card>
      {booking && (
        <Card className="rounded-2xl p-5">
          <p className="mb-1 font-semibold">{a.ask}</p>
          <p className="mb-4 text-sm text-muted">{a.askBody(link.practiceName)}</p>
          <RequestForm tomorrow={addDays(todayIn(link.timezone), 1)} lang={lang} />
        </Card>
      )}
      {past.length > 0 && (
        <Card className="rounded-2xl">
          <p className="px-5 pt-4 pb-2 font-semibold">{a.past}</p>
          <ul className="divide-y divide-line px-5 pb-3">
            {past.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{formatWhenIn(x.starts_at, link.timezone, lang)}</span>
                <Badge tone={APPOINTMENT_STATUS[x.status].tone}>{a.status[x.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
