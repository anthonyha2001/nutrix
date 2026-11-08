import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { ALLERGEN_LABELS } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { IntakeSend } from "./intake-send";

const LABELS: [string, string][] = [
  ["goal", "Goal"],
  ["date_of_birth", "Date of birth"],
  ["sex", "Sex"],
  ["phone", "Phone"],
  ["height_cm", "Height (cm)"],
  ["weight_kg", "Weight (kg)"],
  ["activity_level", "Activity"],
  ["conditions", "Medical conditions"],
  ["medications", "Medications"],
  ["family_history", "Family history"],
  ["allergies", "Allergies"],
  ["other_allergies", "Other allergies"],
  ["meals_per_day", "Meals a day"],
  ["typical_day", "Typical day"],
  ["likes", "Loves"],
  ["dislikes", "Doesn't eat"],
  ["previous_diets", "Previous diets"],
  ["sleep", "Sleep"],
  ["work", "Work"],
  ["exercise", "Exercise"],
  ["smoking", "Smoking or shisha"],
  ["anything_else", "Anything else"],
];

// Health tab: the intake form's status, its answers as sent, and the send button.
export async function IntakePanel({ patient, practiceName }: { patient: { id: string; full_name: string; phone: string | null }; practiceName: string }) {
  const form = await latestIntake(patient.id);
  const firstName = patient.full_name.split(/\s+/)[0];
  const answers = (form?.answers ?? {}) as Record<string, unknown>;
  const show = (k: string, v: unknown) =>
    k === "allergies" ? (Array.isArray(v) ? v.map((a) => ALLERGEN_LABELS[String(a)] ?? String(a)).join(", ") : "") : String(v ?? "");

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Intake form</p>
          <p className="text-sm text-muted">
            {!form
              ? `Send ${firstName} a short form to fill in before the first visit.`
              : form.submitted_at
                ? `Answered on ${formatDate(form.submitted_at)}. The answers were added to the file below.`
                : form.expired
                  ? `Sent on ${formatDate(form.created_at)}; the link expired before it was answered.`
                  : `Sent on ${formatDate(form.created_at)}, not answered yet.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {form?.submitted_at && <Badge tone="green">Answered</Badge>}
          <IntakeSend patientId={patient.id} firstName={firstName} practiceName={practiceName} phone={patient.phone} label={form && !form.submitted_at ? "Send again" : "Send intake form"} />
        </div>
      </div>
      {form?.submitted_at && (
        <details className="mt-3 rounded-lg bg-canvas px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">See the answers as sent</summary>
          <dl className="mt-3 space-y-2">
            {LABELS.filter(([k]) => show(k, answers[k])).map(([k, label]) => (
              <div key={k} className="grid gap-0.5 sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted">{label}</dt>
                <dd className="whitespace-pre-line">{show(k, answers[k])}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </Card>
  );
}

async function latestIntake(patientId: string) {
  const { data } = await (await createClient())
    .from("intake_forms")
    .select("created_at, expires_at, submitted_at, answers")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { ...data, expired: !data.submitted_at && Date.parse(data.expires_at) < Date.now() } : null;
}
