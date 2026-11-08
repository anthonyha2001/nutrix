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
export type PatientLink = { patientId: string; practiceId: string; fullName: string; practiceName: string; timezone: string };

export type SupportRole = PracticeRole | "patient";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  staff: StaffMembership[];
  patientOf: PatientLink[];
  // Runs the Nutrix platform (see /admin).
  isPlatformAdmin: boolean;
  // The practice a super admin has opened, and as whom.
  supportPractice: { id: string; name: string; role: SupportRole; isLab: boolean } | null;
};

// Who is signed in, where they work and where they are a patient. Cached for
// the request; the session token is verified locally (getClaims).
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const id = claims.sub;

  const [{ data: profile }, { data: staffRows }, { data: patientRows }, { data: isAdmin }, { data: visit }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", id).maybeSingle(),
    supabase
      .from("practice_users")
      .select("practice_id, role, practices(name, timezone, lbp_rate)")
      .eq("user_id", id)
      .order("created_at"),
    supabase.from("patients").select("id, practice_id, full_name, practices(name, timezone)").eq("user_id", id).is("archived_at", null).order("created_at"),
    supabase.rpc("is_platform_admin"),
    supabase.from("platform_admin_visits").select("practice_id, role, practices(name, timezone, lbp_rate, is_lab)").eq("user_id", id).maybeSingle(),
  ]);

  const supportPractice =
    isAdmin === true && visit?.practices
      ? { id: visit.practice_id, name: visit.practices.name, role: visit.role as SupportRole, isLab: visit.practices.is_lab }
      : null;

  let staff: StaffMembership[] = (staffRows ?? []).map((r) => ({
    practiceId: r.practice_id,
    practiceName: r.practices?.name ?? "",
    role: r.role,
    timezone: r.practices?.timezone ?? "Asia/Beirut",
    lbpRate: Number(r.practices?.lbp_rate ?? 89500),
  }));
  let patientOf: PatientLink[] = (patientRows ?? []).map((r) => ({
    patientId: r.id,
    practiceId: r.practice_id,
    fullName: r.full_name,
    practiceName: r.practices?.name ?? "",
    timezone: r.practices?.timezone ?? "Asia/Beirut",
  }));

  // While visiting, that practice comes first, as the chosen role.
  if (supportPractice && visit?.practices) {
    if (supportPractice.role === "patient") {
      patientOf = [...patientOf.filter((p) => p.practiceId === supportPractice.id), ...patientOf.filter((p) => p.practiceId !== supportPractice.id)];
    } else {
      staff = [
        {
          practiceId: supportPractice.id,
          practiceName: supportPractice.name,
          role: supportPractice.role,
          timezone: visit.practices.timezone,
          lbpRate: Number(visit.practices.lbp_rate),
        },
        ...staff.filter((s) => s.practiceId !== supportPractice.id),
      ];
    }
  }

  return {
    id,
    email: profile?.email ?? (typeof claims.email === "string" ? claims.email : ""),
    fullName: profile?.full_name ?? "",
    staff,
    patientOf,
    isPlatformAdmin: isAdmin === true,
    supportPractice,
  };
});

// Where a signed-in user belongs: a visited practice first, then staff to the
// dashboard, super admins to the console, patients to the app, everyone else
// sets up a practice.
export function homePathFor(viewer: Pick<Viewer, "staff" | "patientOf" | "isPlatformAdmin" | "supportPractice">) {
  if (viewer.supportPractice) return viewer.supportPractice.role === "patient" ? "/patient" : "/dashboard";
  if (viewer.staff.length > 0) return "/dashboard";
  if (viewer.isPlatformAdmin) return "/admin";
  if (viewer.patientOf.length > 0) return "/patient";
  return "/onboarding";
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requirePlatformAdmin() {
  const viewer = await requireViewer();
  if (!viewer.isPlatformAdmin) redirect(homePathFor(viewer));
  return viewer;
}

// Staff only; pass `roles` to narrow further (others are sent to the overview).
export async function requireStaff(roles?: PracticeRole[]) {
  const viewer = await requireViewer();
  const membership = viewer.supportPractice?.role === "patient" ? undefined : viewer.staff[0];
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
