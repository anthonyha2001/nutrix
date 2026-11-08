import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { formatDateIn } from "@/lib/patient-i18n";
import { patientText } from "@/lib/patient-lang";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitch, RemindersCard } from "../widgets";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { viewer, link } = await requirePatient();
  const { lang, t } = await patientText(viewer);
  const supabase = await createClient();
  const today = todayIn(link.timezone);
  const [{ data: me }, { data: packages }, { data: usage }] = await Promise.all([
    supabase.from("patients").select("full_name, phone, email, date_of_birth, profiles!patients_dietitian_id_fkey(full_name)").eq("id", link.patientId).maybeSingle(),
    supabase.from("patient_packages").select("id, name, consultations_total, expires_on").eq("patient_id", link.patientId).is("cancelled_at", null).gte("expires_on", today),
    supabase.from("package_usage").select("patient_package_id, remaining").eq("patient_id", link.patientId),
  ]);
  const left = new Map((usage ?? []).map((u) => [u.patient_package_id, u.remaining]));
  const p = t.profile;

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>

      <Card className="rounded-2xl p-5">
        <p className="font-semibold">{p.language}</p>
        <p className="mb-3 text-sm text-muted">{p.languageHint}</p>
        <LanguageSwitch lang={lang} />
      </Card>

      <RemindersCard lang={lang} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      <Card className="rounded-2xl">
        <dl className="divide-y divide-line text-sm">
          {(
            [
              [p.name, me?.full_name],
              [p.email, viewer.email],
              [p.phone, me?.phone],
              [p.dob, me?.date_of_birth ? formatDateIn(me.date_of_birth, lang) : null],
              [p.practice, link.practiceName],
              [p.dietitian, me?.profiles?.full_name],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-muted">{k}</dt>
              <dd className="text-end">
                <bdi>{v || "-"}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      {packages && packages.length > 0 && (
        <Card className="rounded-2xl">
          <p className="px-5 pt-4 pb-2 font-semibold">{p.package}</p>
          <ul className="divide-y divide-line px-5 pb-3">
            {packages.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <bdi className="block font-medium">{x.name}</bdi>
                  <span className="block text-xs text-muted">{p.until(formatDateIn(x.expires_on, lang))}</span>
                </span>
                <Badge tone="green">{p.left(left.get(x.id) ?? x.consultations_total, x.consultations_total)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-center text-xs text-muted">{p.change(link.practiceName)}</p>
    </div>
  );
}
