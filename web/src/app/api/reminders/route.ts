import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayIndexFor, type SavedContent } from "@/lib/nutrition";
import { PATIENT_TEXT, type Lang } from "@/lib/patient-i18n";

// Meal reminders. Called every 10 minutes by the database (pg_cron + pg_net,
// see migration 20261114000000) with the shared CRON_SECRET. Sends one push
// per meal whose time came in the last 30 minutes, in the patient's language,
// and records it first so it is never sent twice.

const DEFAULT_TIME: Record<string, string> = { breakfast: "08:00", lunch: "14:00", snack: "17:00", dinner: "20:00" };
const WINDOW_MIN = 30;

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return Response.json({ sent: 0, reason: "VAPID keys not set" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@nutrix.app", publicKey, privateKey);

  const db = createAdminClient();
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth, user_id, patient_id");
  if (!subs?.length) return Response.json({ sent: 0 });
  const patientIds = [...new Set(subs.map((s) => s.patient_id))];
  const userIds = [...new Set(subs.map((s) => s.user_id))];

  const [{ data: patients }, { data: plans }, { data: profiles }] = await Promise.all([
    db.from("patients").select("id, archived_at, practices(timezone)").in("id", patientIds),
    db.from("meal_plans").select("patient_id, starts_on, content").in("patient_id", patientIds).eq("status", "active"),
    db.from("profiles").select("id, locale").in("id", userIds),
  ]);
  const localeOf = new Map((profiles ?? []).map((p) => [p.id, (p.locale === "ar" ? "ar" : "en") as Lang]));

  type Due = { patientId: string; day: string; key: string; slot: string; foods: string[] };
  const due: Due[] = [];
  const now = new Date();
  for (const p of patients ?? []) {
    if (p.archived_at) continue;
    const plan = plans?.find((x) => x.patient_id === p.id);
    const content = plan?.content as SavedContent | undefined;
    if (!plan || !content?.days?.length) continue;
    const tz = (p.practices as { timezone?: string } | null)?.timezone ?? "Asia/Beirut";
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
    const nowMin = minutesOf(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now));
    const today = content.days[dayIndexFor(content, plan.starts_on, day)];
    for (const meal of today.meals) {
      if (!meal.items.length) continue;
      const late = nowMin - minutesOf(meal.time || DEFAULT_TIME[meal.slot] || "12:00");
      if (late >= 0 && late <= WINDOW_MIN) due.push({ patientId: p.id, day, key: meal.key, slot: meal.slot, foods: meal.items.map((i) => i.food_id) });
    }
  }
  if (!due.length) return Response.json({ sent: 0 });

  const foodIds = [...new Set(due.flatMap((d) => d.foods))];
  const [{ data: names }, { data: enFoods }] = await Promise.all([
    db.from("food_translations").select("food_id, name, practice_id").eq("lang", "ar").in("food_id", foodIds),
    db.from("foods").select("id, name").in("id", foodIds),
  ]);
  const arName = new Map<string, string>();
  for (const n of (names ?? []).sort((a, b) => Number(Boolean(a.practice_id)) - Number(Boolean(b.practice_id)))) arName.set(n.food_id, n.name);
  const enName = new Map((enFoods ?? []).map((f) => [f.id, f.name]));

  let sent = 0;
  const gone: string[] = [];
  for (const d of due) {
    // Record first (primary key): already sent, or a slow push, never repeats.
    const { error } = await db.from("meal_reminders_sent").insert({ patient_id: d.patientId, day: d.day, meal_key: d.key });
    if (error) continue;
    for (const s of subs.filter((x) => x.patient_id === d.patientId)) {
      const lang = localeOf.get(s.user_id) ?? "en";
      const t = PATIENT_TEXT[lang];
      const foods = d.foods.map((id) => (lang === "ar" ? arName.get(id) : undefined) ?? enName.get(id) ?? "").filter(Boolean);
      const body = foods.slice(0, 4).join(lang === "ar" ? "، " : ", ") + (foods.length > 4 ? "…" : "");
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: t.reminders.notifyTitle(t.slots[d.slot as keyof typeof t.slots]), body, url: "/patient", dir: t.dir, lang }),
          { TTL: 60 * 60 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
      }
    }
  }
  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);
  return Response.json({ sent, removed: gone.length });
}
