import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { InviteShare } from "@/components/invite-share";
import { RowMenu } from "@/components/row-menu";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { staffInviteMessage } from "@/lib/invite-link";
import { ROLE_LABELS } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cancelInvite, changeRole, removeMember } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { viewer, membership } = await requireStaff();
  const isOwner = membership.role === "owner";
  const supabase = await createClient();
  const [{ data: members }, { data: invites }, { data: patients }] = await Promise.all([
    supabase.from("practice_users").select("user_id, role, created_at, profiles(full_name, email)").eq("practice_id", membership.practiceId).order("created_at"),
    isOwner ? supabase.from("invites").select("*").eq("practice_id", membership.practiceId).is("accepted_at", null).order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("patients").select("dietitian_id").eq("practice_id", membership.practiceId).is("archived_at", null),
  ]);
  const load = (id: string) => patients?.filter((p) => p.dietitian_id === id).length ?? 0;
  const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3300"}/signup`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Dietitians see only their own patients; assistants see contacts, not clinical data."
        action={
          isOwner && (
            <Dialog label="Invite" icon={<UserPlus className="size-4" />} title="Invite to your practice">
              <InviteForm />
            </Dialog>
          )
        }
      />
      <Card>
        <ul className="divide-y divide-line">
          {members?.map((m) => {
            const name = m.profiles?.full_name || m.profiles?.email || "Unnamed";
            const self = m.user_id === viewer.id;
            return (
              <li key={m.user_id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold">
                  {name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {name}
                    {self && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {m.profiles?.email}
                    {m.role !== "assistant" ? ` · ${load(m.user_id)} patient${load(m.user_id) === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <Badge tone={m.role === "owner" ? "green" : "gray"}>{ROLE_LABELS[m.role]}</Badge>
                {isOwner && !self && m.role !== "owner" && (
                  <RowMenu
                    items={[
                      m.role === "assistant"
                        ? { kind: "action", label: "Make dietitian", action: changeRole.bind(null, m.user_id, "dietitian") }
                        : {
                            kind: "action",
                            label: "Make assistant",
                            action: changeRole.bind(null, m.user_id, "assistant"),
                            confirm: `Make ${name} an assistant? They will no longer see clinical files.`,
                          },
                      {
                        kind: "action",
                        label: "Remove from practice",
                        danger: true,
                        action: removeMember.bind(null, m.user_id),
                        confirm: `Remove ${name}? Their patients become unassigned. Their private templates go with them.`,
                      },
                    ]}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {isOwner && invites && invites.length > 0 && (
        <Card>
          <SectionTitle>Waiting to join</SectionTitle>
          <ul className="divide-y divide-line border-t border-line">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.email}</span>
                  <span className="block text-sm text-muted">
                    {ROLE_LABELS[i.role]} · invited {formatDate(i.created_at)}
                  </span>
                </span>
                <InviteShare compact url={signupUrl} message={staffInviteMessage(membership.practiceName, ROLE_LABELS[i.role].toLowerCase(), signupUrl)} />
                <RowMenu items={[{ kind: "action", label: "Cancel invite", danger: true, action: cancelInvite.bind(null, i.id), confirm: `Cancel the invite for ${i.email}?` }]} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
