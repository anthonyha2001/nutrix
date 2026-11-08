import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatThread } from "@/components/chat-thread";
import { hasFeature } from "@/lib/features";
import { patientText } from "@/lib/patient-lang";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "../../message-actions";

export const metadata: Metadata = { title: "Messages" };

export default async function PatientMessagesPage() {
  const { viewer, link } = await requirePatient();
  if (!(await hasFeature(link.practiceId, "messages"))) redirect("/patient");
  const { lang, t } = await patientText(viewer);
  const supabase = await createClient();
  await supabase.rpc("mark_thread_read", { p_patient_id: link.patientId });
  const [{ data: messages }, { data: me }] = await Promise.all([
    supabase.from("messages").select("id, from_patient, body, created_at, read_at, profiles(full_name)").eq("patient_id", link.patientId).order("created_at").limit(300),
    supabase.from("patients").select("profiles!patients_dietitian_id_fkey(full_name)").eq("id", link.patientId).maybeSingle(),
  ]);
  const dietitian = me?.profiles?.full_name?.split(" ")[0] ?? t.messages.yourDietitian;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t.messages.title}</h1>
      <ChatThread
        tall
        asPatient
        lang={lang}
        otherName={dietitian}
        timeZone={link.timezone}
        action={sendMessage.bind(null, link.patientId)}
        messages={(messages ?? []).map((m) => ({ ...m, sender: m.profiles?.full_name ?? null }))}
      />
    </div>
  );
}
