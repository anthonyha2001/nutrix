import "server-only";
import { cache } from "react";
import { practiceFeatures } from "@/lib/features";
import { waNumber } from "@/lib/invite-link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lang } from "@/lib/patient-i18n";

// Automatic WhatsApp from the Nutrix number (Meta WhatsApp Cloud API). Each
// kind is a template approved in WhatsApp Manager under the same name in
// English ("en") and Arabic ("ar"), body variables {{1}}, {{2}}… in order.
// The texts below must match the approved templates word for word (README).

export type WhatsAppKind = "appointment_reminder" | "appointment_confirmed" | "payment_received" | "package_expiring" | "plan_ready";

const TEMPLATE: Record<WhatsAppKind, string> = {
  appointment_reminder: "nutrix_appointment_reminder",
  appointment_confirmed: "nutrix_appointment_confirmed",
  payment_received: "nutrix_payment_received",
  package_expiring: "nutrix_package_expiring",
  plan_ready: "nutrix_plan_ready",
};

// What the patient reads (kept in the log).
export const WHATSAPP_BODIES: Record<WhatsAppKind, Record<Lang, (p: string[]) => string>> = {
  appointment_reminder: {
    en: (p) => `Hi ${p[0]}, a reminder of your appointment at ${p[1]} on ${p[2]}. Reply to this message if you need to change it.`,
    ar: (p) => `مرحباً ${p[0]}، نذكّرك بموعدك في ${p[1]} يوم ${p[2]}. للتعديل، يمكنك الرد على هذه الرسالة.`,
  },
  appointment_confirmed: {
    en: (p) => `Hi ${p[0]}, your appointment at ${p[1]} is confirmed for ${p[2]}.`,
    ar: (p) => `مرحباً ${p[0]}، تمّ تأكيد موعدك في ${p[1]} يوم ${p[2]}.`,
  },
  payment_received: {
    en: (p) => `Hi ${p[0]}, ${p[1]} received your payment of ${p[2]}. Thank you!`,
    ar: (p) => `مرحباً ${p[0]}، استلمنا في ${p[1]} دفعتك بقيمة ${p[2]}. شكراً لك!`,
  },
  package_expiring: {
    en: (p) => `Hi ${p[0]}, your ${p[1]} package at ${p[2]} ends on ${p[3]} and you still have ${p[4]} consultations. Book them before it ends.`,
    ar: (p) => `مرحباً ${p[0]}، تنتهي باقتك «${p[1]}» في ${p[2]} بتاريخ ${p[3]}، ولا يزال لديك ${p[4]} استشارات. احجزها قبل انتهائها.`,
  },
  plan_ready: {
    en: (p) => `Hi ${p[0]}, ${p[1]} has shared your new meal plan. Open it in the Nutrix app: ${p[2]}`,
    ar: (p) => `مرحباً ${p[0]}، شاركت ${p[1]} برنامجك الغذائي الجديد. افتحه في تطبيق Nutrix: ${p[2]}`,
  },
};

export const whatsappKeys = cache(async (): Promise<{ token: string; phoneNumberId: string } | null> => {
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return { token: process.env.WHATSAPP_TOKEN, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SECRET_KEY) return null;
  const { data } = await createAdminClient().from("platform_secrets").select("whatsapp_token, whatsapp_phone_number_id").maybeSingle();
  return data?.whatsapp_token && data.whatsapp_phone_number_id ? { token: data.whatsapp_token, phoneNumberId: data.whatsapp_phone_number_id } : null;
});

// Sends one message, at most once per (kind, ref). Never throws: failures are
// kept in whatsapp_log for the practice to see.
export async function sendWhatsApp(msg: { kind: WhatsAppKind; ref: string; practiceId: string; patientId: string; phone: string | null; lang: Lang; params: string[] }) {
  const to = waNumber(msg.phone);
  if (!to) return;
  const keys = await whatsappKeys();
  if (!keys) return;
  // Feature switches are read with the admin client here (no user session in cron).
  const admin = createAdminClient();
  const { data: on } = await admin.rpc("practice_features", { p_practice_id: msg.practiceId });
  if (!(on ?? []).includes("whatsapp")) return;

  const { data: row } = await admin
    .from("whatsapp_log")
    .upsert(
      { practice_id: msg.practiceId, patient_id: msg.patientId, kind: msg.kind, ref: msg.ref, lang: msg.lang, to_phone: to, body: WHATSAPP_BODIES[msg.kind][msg.lang](msg.params) },
      { onConflict: "kind,ref", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (!row) return; // already sent

  let error: string | null = null;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${keys.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: TEMPLATE[msg.kind], language: { code: msg.lang }, components: [{ type: "body", parameters: msg.params.map((text) => ({ type: "text", text })) }] },
      }),
    });
    if (!res.ok) error = ((await res.json().catch(() => null))?.error?.message as string | undefined) ?? `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Network error";
  }
  await admin.from("whatsapp_log").update({ status: error ? "failed" : "sent", error }).eq("id", row.id);
}

// Used by staff pages: is automatic WhatsApp on for this practice?
export async function whatsappOn(practiceId: string) {
  return Boolean(await whatsappKeys()) && (await practiceFeatures(practiceId)).has("whatsapp");
}
