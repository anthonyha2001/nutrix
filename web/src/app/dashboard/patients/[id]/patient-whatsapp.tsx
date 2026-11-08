import { MessageCircle } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { WhatsAppComposer } from "@/components/whatsapp-composer";
import { formatDate, todayIn } from "@/lib/format";
import type { StaffMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatWhen } from "@/lib/time";
import { preparedMessages, type MessageContext } from "@/lib/whatsapp-messages";

// The patient file's WhatsApp button: messages prepared from what is true for
// this patient today. Row-level security decides what goes in: an assistant
// gets no clinical messages, a dietitian no billing ones.
export async function PatientWhatsApp({
  patient,
  membership,
  senderName,
}: {
  patient: { id: string; full_name: string; phone: string | null; user_id: string | null };
  membership: StaffMembership;
  senderName: string | null;
}) {
  const context = await messageContext(patient, membership, senderName);
  return (
    <Dialog label="WhatsApp" icon={<MessageCircle className="size-4" />} variant="secondary" title={`Message ${context.firstName} on WhatsApp`} description="Prepared from the file. Edit it, then send it from your WhatsApp." size="lg">
      <WhatsAppComposer messages={preparedMessages(context)} phone={patient.phone} />
    </Dialog>
  );
}

async function messageContext(
  patient: { id: string; full_name: string; phone: string | null; user_id: string | null },
  membership: StaffMembership,
  senderName: string | null,
): Promise<MessageContext> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const today = todayIn(membership.timezone);
  const [{ data: plan }, { data: next }, { data: missed }, { data: lastLog }, { data: packages }, { data: balances }] = await Promise.all([
    supabase.from("meal_plans").select("name").eq("patient_id", patient.id).eq("status", "active").maybeSingle(),
    supabase.from("appointments").select("starts_at, online").eq("patient_id", patient.id).in("status", ["confirmed", "requested"]).gte("starts_at", now).order("starts_at").limit(1).maybeSingle(),
    // A no-show in the last two weeks.
    supabase
      .from("appointments")
      .select("starts_at")
      .eq("patient_id", patient.id)
      .eq("status", "no_show")
      .gte("starts_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("diary_entries").select("eaten_on").eq("patient_id", patient.id).order("eaten_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("patient_packages").select("id, name, expires_on").eq("patient_id", patient.id).is("cancelled_at", null).gte("expires_on", today).order("expires_on").limit(1),
    supabase.from("invoice_balances").select("due_usd").eq("patient_id", patient.id).gt("due_usd", 0),
  ]);

  const pkg = packages?.[0];
  const { data: usage } = pkg ? await supabase.from("package_usage").select("remaining").eq("patient_package_id", pkg.id).maybeSingle() : { data: null };
  const balance = (balances ?? []).reduce((a, b) => a + Number(b.due_usd), 0);
  const days = lastLog ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastLog.eaten_on}T00:00:00Z`)) / 86_400_000) : undefined;

  return {
    firstName: patient.full_name.split(/\s+/)[0],
    practiceName: membership.practiceName,
    senderName,
    usesApp: Boolean(patient.user_id),
    activePlan: plan ? { name: plan.name } : undefined,
    nextAppointment: next ? { when: formatWhen(next.starts_at, membership.timezone), online: next.online } : undefined,
    missedAppointment: missed ? { when: formatWhen(missed.starts_at, membership.timezone) } : undefined,
    daysSinceLog: days,
    pkg: pkg && usage ? { name: pkg.name, remaining: usage.remaining ?? 0, expires: formatDate(pkg.expires_on) } : undefined,
    balanceUsd: balance > 0 ? balance : undefined,
  };
}
