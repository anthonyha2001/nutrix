"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, isUnreachable, UNREACHABLE_MESSAGE } from "@/lib/supabase/config";
import { text } from "@/lib/action-result";

export type AuthFormState = { error?: string; message?: string; email?: string };

const NOT_CONFIGURED = "Nutrix isn't connected to its database yet. See the README to finish setup.";

// Only same-site paths, so a crafted ?next= can't send people to another website.
function safeNext(formData: FormData) {
  const next = text(formData, "next");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

// Where a freshly signed-in user belongs (staff, patient, or new practice).
async function homePath(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const [{ count: staff }, { count: patient }] = await Promise.all([
    supabase.from("practice_users").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (staff) return "/dashboard";
  if (patient) return "/patient";
  return "/onboarding";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!email || typeof password !== "string" || !password) {
    return { error: "Enter your email and password.", email };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (isUnreachable(error)) return { error: UNREACHABLE_MESSAGE, email };
    if (error.code === "email_not_confirmed") return { error: "Confirm your email first. Check your inbox.", email };
    return { error: "Wrong email or password.", email };
  }
  // Pick up staff invites and patient records sent to this email since signup.
  await supabase.rpc("claim_mine");
  redirect(safeNext(formData) ?? (await homePath(supabase, data.user.id)));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (fullName.length < 2) return { error: "Enter your full name.", email };
  if (!email || typeof password !== "string" || password.length < 8) {
    return { error: "Enter your email and a password of at least 8 characters.", email };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) {
    if (isUnreachable(error)) return { error: UNREACHABLE_MESSAGE, email };
    if (error.code === "user_already_exists") return { error: "An account with this email already exists. Log in instead.", email };
    return { error: "Couldn't create the account. Please try again.", email };
  }
  if (!data.session) return { message: "Check your email to confirm your account, then log in.", email };
  redirect(safeNext(formData) ?? (await homePath(supabase, data.session.user.id)));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
