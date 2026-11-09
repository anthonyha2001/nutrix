"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionState } from "@/lib/action-result";
import { cleanupDemos, createDemo, deleteDemoFor, demoPartner, demoPassword, isDemoEmail, visitorHash } from "@/lib/demo";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

async function signInAs(email: string) {
  const { error } = await (await createClient()).auth.signInWithPassword({ email, password: demoPassword(email) });
  return error;
}

// "Start the demo": a fresh sample practice, signed in as its dietitian.
export async function startDemo(): Promise<ActionState> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const result = await createDemo(visitorHash(ip));
  if ("error" in result) return { error: result.error };
  // A visitor's earlier sample practice goes away when they start a new one.
  const viewer = await getViewer();
  if (viewer && isDemoEmail(viewer.email)) await deleteDemoFor(viewer.id);
  if (await signInAs(result.ownerEmail)) return { error: "The demo couldn't sign you in. Please try again." };
  after(() => cleanupDemos());
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Dietitian dashboard <-> the patient's app, same sample practice.
export async function switchDemoRole(to: "owner" | "patient") {
  const viewer = await getViewer();
  if (!viewer || !isDemoEmail(viewer.email)) redirect("/demo");
  const email = await demoPartner(viewer.id, to);
  if (!email || (await signInAs(email))) redirect("/demo");
  revalidatePath("/", "layout");
  redirect(to === "patient" ? "/patient" : "/dashboard");
}

// Leaves the demo: the sample practice is deleted right away.
export async function endDemo(next: "signup" | "home") {
  const viewer = await getViewer();
  if (viewer && isDemoEmail(viewer.email)) {
    await (await createClient()).auth.signOut();
    await deleteDemoFor(viewer.id);
  }
  revalidatePath("/", "layout");
  redirect(next === "signup" ? "/signup" : "/");
}
