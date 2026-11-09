import Link from "next/link";
import { Send, Stethoscope, Video } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { Dialog } from "@/components/dialog";
import { PatientSummaryCard } from "@/components/patient-summary";
import { RouteModal } from "@/components/route-modal";
import { Badge, buttonClass } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { usd } from "@/lib/money";
import { patientSummary } from "@/lib/patient-summary";
import type { StaffMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { APPOINTMENT_STATUS, formatWhen, isoToLocal } from "@/lib/time";
import { PackageRenewal } from "../billing/package-renewal";
import { NoteForm } from "../patients/forms";
import { addAppointmentNote, cancelAppointment, confirmAppointment, markAttendance, rescheduleAppointment } from "./actions";
import { CancelForm, RescheduleForm } from "./forms";

// One appointment, opened as ?appt=<id> on the calendar or the patient file.
export async function AppointmentDetail({ id, membership }: { id: string; membership: StaffMembership }) {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, phone), services(name, price_usd), dietitian:profiles!appointments_dietitian_id_fkey(full_name), patient_packages(name)")
    .eq("id", id)
    .maybeSingle();
  if (!a || !a.patients) return null;

  const tz = membership.timezone;
  const { data: clinical } = await supabase.rpc("can_see_clinical", { p_patient_id: a.patient_id });
  const summary = clinical ? await patientSummary(a.patient_id, tz) : null;
  const { data: wa } = await supabase.from("whatsapp_log").select("kind, status, created_at").like("ref", `${a.id}:%`).order("created_at");
  const local = isoToLocal(a.starts_at, tz);
  const minutes = Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000);
  const open = a.status === "requested" || a.status === "confirmed";
  // Attendance can be recorded from the day of the appointment.
  const canMark = open && local.date <= todayIn(tz);
  const status = APPOINTMENT_STATUS[a.status];
  const firstName = a.patients.full_name.split(/\s+/)[0];

  return (
    <RouteModal param="appt" size="lg" title={a.patients.full_name} description={formatWhen(a.starts_at, tz)}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="text-muted">
            {minutes} min
            {a.services ? ` · ${a.services.name} (${usd(a.services.price_usd)})` : ""}
            {a.dietitian?.full_name ? ` · with ${a.dietitian.full_name}` : ""}
          </span>
          {a.online && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Video className="size-4" /> Online
            </span>
          )}
        </div>

        {a.patient_note && (
          <p className="rounded-lg bg-canvas px-3 py-2 text-sm">
            <span className="font-medium">Patient&apos;s note:</span> {a.patient_note}
          </p>
        )}
        {a.note && <p className="text-sm text-muted">{a.note}</p>}
        {a.status === "cancelled" && a.cancel_reason && <p className="text-sm text-muted">Cancelled: {a.cancel_reason}</p>}
        {a.status === "completed" && <p className="text-sm text-muted">{a.patient_packages ? `Counted against ${a.patient_packages.name}.` : "Not counted against a package."}</p>}

        {summary && <PatientSummaryCard s={summary} />}

        <p className="flex items-start gap-2 text-xs text-muted">
          <Send className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {wa?.length
              ? wa.map((w) => `${w.kind === "appointment_reminder" ? "Reminder" : "Confirmation"} ${w.status === "sent" ? "sent" : w.status === "failed" ? "failed" : "sending"} ${formatWhen(w.created_at, tz)}`).join(" · ")
              : "WhatsApp: the confirmation goes out automatically when booked, and a reminder the day before."}
          </span>
        </p>
        {(open || a.status === "completed") && <PackageRenewal patientId={a.patient_id} firstName={firstName} membership={membership} />}

        {open && !canMark && <p className="text-xs text-muted">Attendance can be recorded from the day of the appointment.</p>}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {clinical && (open || a.status === "completed") && (
            <Link href={`/dashboard/patients/${a.patient_id}/consult?appt=${a.id}`} className={buttonClass("primary")}>
              <Stethoscope className="size-4" /> Start consultation
            </Link>
          )}
          {a.status === "requested" && (
            <ActionButton variant="primary" action={confirmAppointment.bind(null, a.id)}>
              Confirm
            </ActionButton>
          )}
          {canMark && (
            <>
              <ActionButton variant="primary" action={markAttendance.bind(null, a.id, true)}>
                Attended
              </ActionButton>
              <ActionButton action={markAttendance.bind(null, a.id, false)} confirm={`Mark ${firstName} as a no-show?`}>
                No-show
              </ActionButton>
            </>
          )}
          {open && (
            <>
              <Dialog label="Move" variant="secondary" title="Move appointment">
                <RescheduleForm action={rescheduleAppointment.bind(null, a.id)} date={local.date} time={local.time} duration={minutes} />
              </Dialog>
              <Dialog label="Cancel" variant="danger" title="Cancel appointment">
                <CancelForm action={cancelAppointment.bind(null, a.id)} />
              </Dialog>
            </>
          )}
          {clinical && (a.status === "completed" || open) && (
            <Dialog label="Consultation note" variant="secondary" title="Consultation note" size="lg">
              <NoteForm action={addAppointmentNote.bind(null, a.patient_id, a.id)} today={todayIn(tz)} />
            </Dialog>
          )}
          <Link href={`/dashboard/patients/${a.patient_id}`} className={buttonClass("ghost")}>
            Open file
          </Link>
        </div>
      </div>
    </RouteModal>
  );
}
