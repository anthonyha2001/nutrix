import "server-only";
import { formatDateIn, formatWhenIn, type Lang } from "@/lib/patient-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { usd } from "@/lib/money";
import { sendWhatsApp } from "@/lib/whatsapp";

// The events that send WhatsApp automatically. Each loads what it needs with
// the admin client (it also runs from cron, without a user), and is safe to
// call more than once: the log keeps one message per (kind, ref).

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://nutrix-sigma.vercel.app").replace(/\/+$/, "");

type PatientRow = { id: string; full_name: string; phone: string | null; practice_id: string; user_id: string | null; practices: { name: string; timezone: string } | null };

async function patientLangOf(p: PatientRow): Promise<Lang> {
  if (!p.user_id) return "en";
  const { data } = await createAdminClient().from("profiles").select("locale").eq("id", p.user_id).maybeSingle();
  return data?.locale === "ar" ? "ar" : "en";
}

async function patient(id: string) {
  const { data } = await createAdminClient().from("patients").select("id, full_name, phone, practice_id, user_id, practices(name, timezone)").eq("id", id).maybeSingle();
  return data as PatientRow | null;
}

export async function notifyAppointmentConfirmed(appointmentId: string) {
  const { data: a } = await createAdminClient().from("appointments").select("id, patient_id, starts_at, status").eq("id", appointmentId).maybeSingle();
  if (!a || a.status !== "confirmed") return;
  const p = await patient(a.patient_id);
  if (!p?.practices) return;
  const lang = await patientLangOf(p);
  await sendWhatsApp({
    kind: "appointment_confirmed",
    ref: `${a.id}:${a.starts_at}`,
    practiceId: p.practice_id,
    patientId: p.id,
    phone: p.phone,
    lang,
    params: [first(p.full_name), p.practices.name, formatWhenIn(a.starts_at, p.practices.timezone, lang)],
  });
}

export async function notifyPayment(paymentId: string) {
  const { data: pay } = await createAdminClient().from("payments").select("id, amount_usd, invoices(patient_id)").eq("id", paymentId).maybeSingle();
  const patientId = (pay?.invoices as { patient_id?: string } | null)?.patient_id;
  if (!pay || !patientId) return;
  const p = await patient(patientId);
  if (!p?.practices) return;
  const lang = await patientLangOf(p);
  await sendWhatsApp({ kind: "payment_received", ref: pay.id, practiceId: p.practice_id, patientId: p.id, phone: p.phone, lang, params: [first(p.full_name), p.practices.name, usd(pay.amount_usd)] });
}

export async function notifyPlanReady(planId: string) {
  const { data: plan } = await createAdminClient().from("meal_plans").select("id, patient_id, status, activated_at").eq("id", planId).maybeSingle();
  if (!plan || plan.status !== "active") return;
  const p = await patient(plan.patient_id);
  if (!p?.practices) return;
  const lang = await patientLangOf(p);
  await sendWhatsApp({ kind: "plan_ready", ref: `${plan.id}:${plan.activated_at}`, practiceId: p.practice_id, patientId: p.id, phone: p.phone, lang, params: [first(p.full_name), p.practices.name, `${SITE()}/patient/plan`] });
}

// Hourly (cron): reminders for tomorrow's appointments (from 10:00 local
// time), and packages ending in 3 days with consultations left.
export async function sendScheduledWhatsApp() {
  const db = createAdminClient();
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3600_000).toISOString();
  const { data: appts } = await db
    .from("appointments")
    .select("id, patient_id, starts_at, practices(timezone)")
    .eq("status", "confirmed")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", soon);
  let reminders = 0;
  for (const a of appts ?? []) {
    const tz = (a.practices as { timezone?: string } | null)?.timezone ?? "Asia/Beirut";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(a.starts_at));
    if (day !== tomorrow.toISOString().slice(0, 10) || hour < 10) continue;
    const p = await patient(a.patient_id);
    if (!p?.practices) continue;
    const lang = await patientLangOf(p);
    await sendWhatsApp({
      kind: "appointment_reminder",
      ref: `${a.id}:${a.starts_at}`,
      practiceId: p.practice_id,
      patientId: p.id,
      phone: p.phone,
      lang,
      params: [first(p.full_name), p.practices.name, formatWhenIn(a.starts_at, tz, lang)],
    });
    reminders++;
  }

  let packages = 0;
  const { data: pkgs } = await db.from("patient_packages").select("id, name, patient_id, expires_on, practices(timezone)").is("cancelled_at", null);
  const { data: usage } = await db.from("package_usage").select("patient_package_id, remaining");
  const left = new Map((usage ?? []).map((u) => [u.patient_package_id, u.remaining]));
  for (const pk of pkgs ?? []) {
    const tz = (pk.practices as { timezone?: string } | null)?.timezone ?? "Asia/Beirut";
    const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now)}T00:00:00Z`);
    today.setUTCDate(today.getUTCDate() + 3);
    if (pk.expires_on !== today.toISOString().slice(0, 10) || !((left.get(pk.id) ?? 0) > 0)) continue;
    const p = await patient(pk.patient_id);
    if (!p?.practices) continue;
    const lang = await patientLangOf(p);
    await sendWhatsApp({
      kind: "package_expiring",
      ref: pk.id,
      practiceId: p.practice_id,
      patientId: p.id,
      phone: p.phone,
      lang,
      params: [first(p.full_name), pk.name, p.practices.name, formatDateIn(pk.expires_on, lang), String(left.get(pk.id))],
    });
    packages++;
  }
  return { reminders, packages };
}

// Sent when staff press "Send on WhatsApp" (no manual links): the app invite
// and the intake form. Returns why it wasn't sent, if it wasn't.
export async function sendAppInvite(patientId: string, url: string) {
  const p = await patient(patientId);
  if (!p?.practices) return { error: "not_found" as const };
  const lang = await patientLangOf(p);
  return sendWhatsApp({ kind: "app_invite", ref: `${p.id}:${new Date().toISOString().slice(0, 10)}`, practiceId: p.practice_id, patientId: p.id, phone: p.phone, lang, params: [first(p.full_name), p.practices.name, url] });
}

export async function sendIntakeForm(patientId: string, url: string) {
  const p = await patient(patientId);
  if (!p?.practices) return { error: "not_found" as const };
  const lang = await patientLangOf(p);
  return sendWhatsApp({ kind: "intake_form", ref: url, practiceId: p.practice_id, patientId: p.id, phone: p.phone, lang, params: [first(p.full_name), p.practices.name, url] });
}
