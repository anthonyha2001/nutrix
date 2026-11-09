import "server-only";
import { cache } from "react";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// The hands-on demo (same model as Gymix): each visitor gets a private sample
// practice (Cedar Nutrition) with a dietitian sign-in and a patient sign-in,
// deleted after 24 hours. Passwords are derived from the email with a server
// secret, so switching between the two never needs them stored.

const DOMAIN = "demo.nutrix.invalid";
const PER_VISITOR_PER_HOUR = 5;
const PER_DAY = 400;

function secret() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("The demo needs SUPABASE_SERVICE_ROLE_KEY");
  return key;
}

export function demoPassword(email: string) {
  return createHmac("sha256", secret()).update(`nutrix-demo:${email}`).digest("base64url").slice(0, 32);
}

export const isDemoEmail = (email: string | null | undefined) => Boolean(email?.endsWith(`@${DOMAIN}`));

export function visitorHash(ip: string) {
  return createHash("sha256").update(`${secret().slice(-16)}:${ip}`).digest("hex").slice(0, 32);
}

// Creates the two sign-ins and the sample practice. Limited per visitor and per day.
export async function createDemo(ipHash: string): Promise<{ ownerEmail: string } | { error: string }> {
  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: mine }, { count: today }] = await Promise.all([
    admin.from("demo_starts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("created_at", hourAgo),
    admin.from("demo_starts").select("id", { count: "exact", head: true }).gt("created_at", dayAgo),
  ]);
  if ((mine ?? 0) >= PER_VISITOR_PER_HOUR) return { error: "You've started a few demos in the last hour. Try again a little later." };
  if ((today ?? 0) >= PER_DAY) return { error: "The demo is very busy today. Try again tomorrow, or open your practice." };
  await admin.from("demo_starts").insert({ ip_hash: ipHash });

  const tag = randomBytes(6).toString("hex");
  const ownerEmail = `dietitian-${tag}@${DOMAIN}`;
  const patientEmail = `patient-${tag}@${DOMAIN}`;
  const created: string[] = [];
  try {
    for (const [email, name] of [
      [ownerEmail, "Dr. Maya Demo"],
      [patientEmail, "Lina Khoury"],
    ]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: demoPassword(email), email_confirm: true, user_metadata: { full_name: name } });
      if (error || !data.user) throw error ?? new Error("Couldn't create the demo account");
      created.push(data.user.id);
    }
    const { error } = await admin.rpc("create_demo_practice", { p_owner: created[0], p_patient_user: created[1] });
    if (error) throw error;
    return { ownerEmail };
  } catch (e) {
    for (const id of created) await admin.auth.admin.deleteUser(id);
    console.error("demo start failed", e);
    return { error: "The demo couldn't be set up just now. Please try again." };
  }
}

// The other sign-in of the same sample practice (dietitian <-> patient).
export async function demoPartner(userId: string, wanted: "owner" | "patient") {
  const admin = createAdminClient();
  const { data: me } = await admin.from("demo_users").select("practice_id").eq("user_id", userId).maybeSingle();
  if (!me) return null;
  const { data: other } = await admin.from("demo_users").select("user_id").eq("practice_id", me.practice_id).eq("role", wanted).maybeSingle();
  if (!other) return null;
  const { data } = await admin.auth.admin.getUserById(other.user_id);
  return data.user?.email ?? null;
}

async function deleteDemoPractice(practiceId: string, userIds: string[]) {
  const admin = createAdminClient();
  await admin.from("practices").delete().eq("id", practiceId);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
}

export async function deleteDemoFor(userId: string) {
  const admin = createAdminClient();
  const { data: me } = await admin.from("demo_users").select("practice_id").eq("user_id", userId).maybeSingle();
  if (!me) return;
  const { data: users } = await admin.from("demo_users").select("user_id").eq("practice_id", me.practice_id);
  await deleteDemoPractice(me.practice_id, (users ?? []).map((u) => u.user_id));
}

// Removes sample practices past their 24 hours.
export async function cleanupDemos(limit = 25) {
  const admin = createAdminClient();
  const { data } = await admin.rpc("expired_demo_practices", { p_limit: limit });
  for (const p of data ?? []) await deleteDemoPractice(p.practice_id, p.user_ids ?? []);
  await admin.from("demo_starts").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
  return data?.length ?? 0;
}

// When this practice's demo ends, or null for a real practice.
export const demoExpiry = cache(async (practiceId: string): Promise<string | null> => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SECRET_KEY) return null;
  const { data } = await createAdminClient().from("practices").select("demo_expires_at").eq("id", practiceId).maybeSingle();
  return data?.demo_expires_at ?? null;
});
