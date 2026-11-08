import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { formatDate, todayIn } from "@/lib/format";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { viewer, link } = await requirePatient();
  const supabase = await createClient();
  const today = todayIn(link.timezone);
  const [{ data: me }, { data: packages }, { data: usage }] = await Promise.all([
    supabase.from("patients").select("full_name, phone, email, date_of_birth, profiles!patients_dietitian_id_fkey(full_name)").eq("id", link.patientId).maybeSingle(),
    supabase.from("patient_packages").select("id, name, consultations_total, expires_on, cancelled_at").eq("patient_id", link.patientId).is("cancelled_at", null).gte("expires_on", today),
    supabase.from("package_usage").select("patient_package_id, remaining").eq("patient_id", link.patientId),
  ]);
  const left = new Map((usage ?? []).map((u) => [u.patient_package_id, u.remaining]));

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <Card className="rounded-2xl">
        <dl className="divide-y divide-line text-sm">
          {(
            [
              ["Name", me?.full_name],
              ["Email", viewer.email],
              ["Phone", me?.phone],
              ["Date of birth", me?.date_of_birth ? formatDate(me.date_of_birth) : null],
              ["Practice", link.practiceName],
              ["Dietitian", me?.profiles?.full_name],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right">{v || "-"}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {packages && packages.length > 0 && (
        <Card className="rounded-2xl">
          <p className="px-5 pt-4 pb-2 font-semibold">Your package</p>
          <ul className="divide-y divide-line px-5 pb-3">
            {packages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-muted">Until {formatDate(p.expires_on)}</span>
                </span>
                <Badge tone="green">
                  {left.get(p.id) ?? p.consultations_total} of {p.consultations_total} left
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-center text-xs text-muted">To change your details, ask {link.practiceName}.</p>
    </div>
  );
}
