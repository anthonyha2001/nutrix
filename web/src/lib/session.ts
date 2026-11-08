import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PracticeRole } from "@/lib/roles";

export type StaffMembership = {
  practiceId: string;
  practiceName: string;
  role: PracticeRole;
  timezone: string;
  lbpRate: number;
};

// A practice where this user is a patient (Nutrix Patient app).
export type PatientLink = { patientId: string; practiceId: string; fullName: string };

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  staff: StaffMembership[];
  patientOf: PatientLink[];
};

// Who is signed in, where they work and where they are a patient. Cached for
// the request; the session token is verified locally (getClaims).
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const id = claims.sub;

  const [{ data: profile }, { data: staffRows }, { data: patientRows }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", id).maybeSingle(),
    supabase
      .from("practice_users")
      .select("practice_id, role, practices(name, timezone, lbp_rate)")
      .eq("user_id", id)
      .order("created_at"),
    supabase.from("patients").select("id, practice_id, full_name").eq("user_id", id).is("archived_at", null),
  ]);

  return {
    id,
    email: profile?.email ?? (typeof claims.email === "string" ? claims.email : ""),
    fullName: profile?.full_name ?? "",
    staff: (staffRows ?? []).map((r) => ({
      practiceId: r.practice_id,
      practiceName: r.practices?.name ?? "",
      role: r.role,
      timezone: r.practices?.timezone ?? "Asia/Beirut",
      lbpRate: Number(r.practices?.lbp_rate ?? 89500),
    })),
    patientOf: (patientRows ?? []).map((r) => ({ patientId: r.id, practiceId: r.practice_id, fullName: r.full_name })),
  };
});

// Staff go to the dashboard, patients to the patient app, everyone else sets
// up a practice.
export function homePathFor(viewer: Pick<Viewer, "staff" | "patientOf">) {
  if (viewer.staff.length > 0) return "/dashboard";
  if (viewer.patientOf.length > 0) return "/patient";
  return "/onboarding";
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

// Staff only; pass `roles` to narrow further (others are sent to the overview).
export async function requireStaff(roles?: PracticeRole[]) {
  const viewer = await requireViewer();
  const membership = viewer.staff[0];
  if (!membership) redirect(homePathFor(viewer));
  if (roles && !roles.includes(membership.role)) redirect("/dashboard");
  return { viewer, membership };
}

export async function requirePatient() {
  const viewer = await requireViewer();
  const link = viewer.patientOf[0];
  if (!link) redirect(homePathFor(viewer));
  return { viewer, link };
}
