"use server";

import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { requireStaff } from "@/lib/session";

const ROLES = ["dietitian", "assistant"] as const;
type StaffRole = (typeof ROLES)[number];

export async function inviteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(["owner"]);
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role") as StaffRole;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  const { error } = await (await createClient()).from("invites").insert({ practice_id: membership.practiceId, email, role, invited_by: viewer.id });
  if (error?.code === "23505") return { error: "That email already has an open invite." };
  return error ? { error: errorMessage(error, "Couldn't send the invite.") } : done("Invite created. Share the link with them.");
}

export async function cancelInvite(id: string): Promise<ActionState> {
  await requireStaff(["owner"]);
  const { error } = await (await createClient()).from("invites").delete().eq("id", id);
  return error ? { error: errorMessage(error) } : done("Invite cancelled");
}

export async function changeRole(userId: string, role: StaffRole): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  const { error, count } = await (await createClient())
    .from("practice_users")
    .update({ role }, { count: "exact" })
    .eq("practice_id", membership.practiceId)
    .eq("user_id", userId);
  if (error) return { error: errorMessage(error) };
  return count ? done("Role changed") : { error: "You can't change that person's role." };
}

export async function removeMember(userId: string): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const supabase = await createClient();
  // Their patients go back to the owner's list, unassigned.
  await supabase.from("patients").update({ dietitian_id: null }).eq("practice_id", membership.practiceId).eq("dietitian_id", userId);
  const { error, count } = await supabase.from("practice_users").delete({ count: "exact" }).eq("practice_id", membership.practiceId).eq("user_id", userId);
  if (error) return { error: errorMessage(error) };
  return count ? done("Removed from the practice") : { error: "You can't remove that person." };
}
