import type { Metadata } from "next";
import Link from "next/link";
import { ChatThread } from "@/components/chat-thread";
import { Card, PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "../../message-actions";
import { StartChat } from "./start-chat";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  if (!(await hasFeature(membership.practiceId, "messages"))) redirect("/dashboard");
  const { p } = await searchParams;
  const supabase = await createClient();
  const open = typeof p === "string" ? p : null;
  // Opening a thread marks the patient's messages as read.
  if (open) await supabase.rpc("mark_thread_read", { p_patient_id: open });

  const [{ data: recent }, { data: patients }] = await Promise.all([
    supabase.from("messages").select("id, patient_id, body, from_patient, created_at, read_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("patients").select("id, full_name, user_id").eq("practice_id", membership.practiceId).is("archived_at", null).order("full_name"),
  ]);
  const names = new Map((patients ?? []).map((x) => [x.id, x.full_name]));
  const threads = new Map<string, { last: NonNullable<typeof recent>[number]; unread: number }>();
  for (const m of recent ?? []) {
    const t = threads.get(m.patient_id) ?? { last: m, unread: 0 };
    if (m.from_patient && !m.read_at) t.unread++;
    threads.set(m.patient_id, t);
  }

  const { data: messages } = open
    ? await supabase.from("messages").select("id, from_patient, body, created_at, read_at, profiles(full_name)").eq("patient_id", open).order("created_at").limit(300)
    : { data: null };
  const openName = open ? names.get(open) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Private conversations with your patients through their app." />
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit">
          <div className="border-b border-line p-3">
            <StartChat patients={(patients ?? []).filter((x) => x.user_id).map((x) => ({ id: x.id, name: x.full_name }))} />
          </div>
          {threads.size === 0 ? (
            <p className="p-5 text-sm text-muted">No conversations yet. Patients who use the app can write to you.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...threads].map(([pid, t]) => (
                <li key={pid}>
                  <Link href={`/dashboard/messages?p=${pid}`} scroll={false} className={`flex items-center gap-3 px-4 py-3 ${open === pid ? "bg-canvas" : "hover:bg-canvas/60"}`}>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${t.unread ? "font-semibold" : "font-medium"}`}>{names.get(pid) ?? "Patient"}</span>
                      <span className="block truncate text-sm text-muted">
                        {t.last.from_patient ? "" : "You: "}
                        {t.last.body}
                      </span>
                    </span>
                    {t.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-semibold">{t.unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {open && openName ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{openName}</h2>
              <Link href={`/dashboard/patients/${open}`} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
                Open file
              </Link>
            </div>
            <ChatThread
              asPatient={false}
              otherName={openName.split(" ")[0]}
              timeZone={membership.timezone}
              action={sendMessage.bind(null, open)}
              messages={(messages ?? []).map((m) => ({ ...m, sender: m.profiles?.full_name ?? null }))}
            />
          </div>
        ) : (
          <Card className="grid min-h-72 place-items-center p-8 text-center text-sm text-muted">Choose a conversation.</Card>
        )}
      </div>
    </div>
  );
}
