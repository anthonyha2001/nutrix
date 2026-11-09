import { Badge, Card, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { whatsappOn } from "@/lib/whatsapp";

const KIND: Record<string, string> = {
  appointment_reminder: "Appointment reminder",
  appointment_confirmed: "Appointment confirmed",
  payment_received: "Payment received",
  package_expiring: "Package ending",
  plan_ready: "New meal plan",
};

// The automatic WhatsApp messages the practice sent, newest first.
export async function WhatsAppLog({ practiceId, timeZone }: { practiceId: string; timeZone: string }) {
  const [on, { data: rows }] = await Promise.all([
    whatsappOn(practiceId),
    (await createClient()).from("whatsapp_log").select("id, kind, body, status, error, created_at, patients(full_name)").eq("practice_id", practiceId).order("created_at", { ascending: false }).limit(30),
  ]);
  return (
    <Card>
      <SectionTitle action={<Badge tone={on ? "green" : "gray"}>{on ? "On" : "Not connected yet"}</Badge>}>Automatic WhatsApp</SectionTitle>
      <p className="px-5 pb-3 text-sm text-muted">
        Sent automatically from the Nutrix number, in each patient&apos;s language: appointment confirmations and reminders the day before, payment receipts, packages ending in 3 days, and new meal plans.
      </p>
      {rows?.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {KIND[r.kind] ?? r.kind}
                  {r.patients?.full_name ? ` · ${r.patients.full_name}` : ""}
                </span>
                <Badge tone={r.status === "sent" ? "green" : r.status === "failed" ? "red" : "gray"}>{r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Sending"}</Badge>
              </div>
              <p className="mt-0.5 text-muted" dir="auto">
                {r.body}
              </p>
              <p className="text-xs text-muted">
                {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone })}
                {r.error ? ` · ${r.error}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-line px-5 py-4 text-sm text-muted">Nothing sent yet.</p>
      )}
    </Card>
  );
}
