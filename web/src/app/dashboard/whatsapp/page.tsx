import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { WHATSAPP_BODIES, whatsappOn } from "@/lib/whatsapp";
import { WhatsAppSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "WhatsApp" };

const KIND: Record<string, string> = {
  appointment_reminder: "Appointment reminder",
  appointment_confirmed: "Appointment confirmed",
  payment_received: "Payment received",
  package_expiring: "Package ending",
  plan_ready: "New meal plan",
  app_invite: "App invite",
  intake_form: "Intake form",
};
const STATUS = ["all", "sent", "failed"] as const;

export default async function WhatsAppPage({ searchParams }: PageProps<"/dashboard/whatsapp">) {
  const { membership } = await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const status = STATUS.includes(sp.status as (typeof STATUS)[number]) ? (sp.status as (typeof STATUS)[number]) : "all";
  const kind = typeof sp.kind === "string" && sp.kind in KIND ? sp.kind : null;
  const supabase = await createClient();
  let q = supabase
    .from("whatsapp_log")
    .select("id, kind, body, status, error, sender, to_phone, created_at, patient_id, patients(full_name)")
    .eq("practice_id", membership.practiceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);
  if (kind) q = q.eq("kind", kind);
  const [{ data: rows }, { data: st }, on] = await Promise.all([q, supabase.rpc("practice_whatsapp_status", { p_practice_id: membership.practiceId }).maybeSingle(), whatsappOn(membership.practiceId)]);
  const link = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(kind ? { kind } : {}) });
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return `/dashboard/whatsapp${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm ${on ? "bg-ink text-white" : "text-muted hover:bg-surface"}`;

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp" description="Messages go out automatically from your WhatsApp or the Nutrix number, in each patient's language. Nothing is sent by hand." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            Sending from <Badge tone={on ? "green" : "amber"}>{on ? (st?.use_own ? "Your number" : "Nutrix number") : "Not connected"}</Badge>
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">Appointment confirmations and reminders the day before, payment receipts, packages ending in 3 days, new meal plans, app invites and intake forms.</p>
          {membership.role === "owner" ? (
            <WhatsAppSettingsForm useOwn={Boolean(st?.use_own)} hasOwnKeys={Boolean(st?.has_own_keys)} phoneNumberId={st?.phone_number_id ?? ""} nutrixReady={Boolean(st?.nutrix_ready)} />
          ) : (
            <p className="text-sm text-muted">Only the practice owner can change where messages are sent from.</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Templates for your own number</h2>
          <p className="mt-1 mb-3 text-sm text-muted">Only needed with your own number: create these in WhatsApp Manager (category Utility), in English (en) and Arabic (ar), with exactly this text.</p>
          <ul className="max-h-80 space-y-3 overflow-y-auto pe-1 text-sm">
            {(Object.keys(WHATSAPP_BODIES) as (keyof typeof WHATSAPP_BODIES)[]).map((k) => (
              <li key={k}>
                <p className="font-mono text-xs font-semibold">nutrix_{k}</p>
                <p className="text-muted">{WHATSAPP_BODIES[k].en(["{{1}}", "{{2}}", "{{3}}", "{{4}}", "{{5}}"])}</p>
                <p className="text-muted" dir="rtl">
                  {WHATSAPP_BODIES[k].ar(["{{1}}", "{{2}}", "{{3}}", "{{4}}", "{{5}}"])}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionTitle>Sent automatically</SectionTitle>
        <div className="flex flex-wrap gap-1 border-t border-line px-4 py-3">
          {STATUS.map((s) => (
            <Link key={s} href={link({ status: s === "all" ? null : s })} className={chip(status === s)}>
              {s === "all" ? "All" : s === "sent" ? "Sent" : "Failed"}
            </Link>
          ))}
          <span className="mx-2 w-px bg-line" />
          <Link href={link({ kind: null })} className={chip(!kind)}>
            Every message
          </Link>
          {Object.entries(KIND).map(([k, label]) => (
            <Link key={k} href={link({ kind: k })} className={chip(kind === k)}>
              {label}
            </Link>
          ))}
        </div>
        {!rows?.length ? (
          <EmptyState>
            <span className="block pt-2">Nothing here yet.</span>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {KIND[r.kind] ?? r.kind}
                    {r.patients?.full_name && (
                      <>
                        {" · "}
                        <Link href={`/dashboard/patients/${r.patient_id}`} className="hover:underline">
                          {r.patients.full_name}
                        </Link>
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted">{r.sender === "own" ? "Your number" : "Nutrix number"}</span>
                    <Badge tone={r.status === "sent" ? "green" : r.status === "failed" ? "red" : "gray"}>{r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Sending"}</Badge>
                  </span>
                </div>
                <p className="mt-1 text-muted" dir="auto">
                  {r.body}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: membership.timezone })}
                  {r.to_phone ? ` · +${r.to_phone}` : ""}
                  {r.error ? ` · ${r.error}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
