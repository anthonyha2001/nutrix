import type { Metadata } from "next";
import { ChatThread } from "@/components/chat-thread";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "../../message-actions";

export const metadata: Metadata = { title: "Messages" };

export default async function PatientMessagesPage() {
  const { link } = await requirePatient();
  const supabase = await createClient();
  await supabase.rpc("mark_thread_read", { p_patient_id: link.patientId });
  const [{ data: messages }, { data: me }] = await Promise.all([
    supabase.from("messages").select("id, from_patient, body, created_at, read_at, profiles(full_name)").eq("patient_id", link.patientId).order("created_at").limit(300),
    supabase.from("patients").select("profiles!patients_dietitian_id_fkey(full_name)").eq("id", link.patientId).maybeSingle(),
  ]);
  const dietitian = me?.profiles?.full_name?.split(" ")[0] ?? "your dietitian";

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <ChatThread
        tall
        asPatient
        otherName={dietitian}
        timeZone={link.timezone}
        action={sendMessage.bind(null, link.patientId)}
        messages={(messages ?? []).map((m) => ({ ...m, sender: m.profiles?.full_name ?? null }))}
      />
    </div>
  );
}
