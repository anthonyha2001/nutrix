import type { Metadata } from "next";
import { TrendChart } from "@/components/trend-chart";
import { Card } from "@/components/ui";
import { formatDate, num, todayIn } from "@/lib/format";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { WeightForm } from "../widgets";

export const metadata: Metadata = { title: "Progress" };

const SOURCE: Record<string, string> = { patient: "You", manual: "At the clinic", inbody: "InBody", tanita: "Tanita", withings: "Withings", apple_health: "Apple Health" };

export default async function ProgressPage() {
  const { link } = await requirePatient();
  const { data: rows } = await (await createClient())
    .from("measurements")
    .select("id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, source")
    .eq("patient_id", link.patientId)
    .order("measured_on")
    .order("created_at");
  const weights = (rows ?? []).filter((r) => r.weight_kg !== null);

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <Card className="rounded-2xl p-5">
        <p className="mb-3 font-semibold">Record your weight</p>
        <WeightForm today={todayIn(link.timezone)} />
      </Card>
      {weights.length > 1 && (
        <Card className="rounded-2xl p-4">
          <TrendChart title="Weight" unit="kg" points={weights.map((w) => ({ date: w.measured_on, value: Number(w.weight_kg) }))} />
        </Card>
      )}
      <Card className="rounded-2xl">
        <p className="px-5 pt-4 pb-2 font-semibold">History</p>
        {rows?.length ? (
          <ul className="divide-y divide-line px-5 pb-2">
            {[...rows].reverse().map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="block">{formatDate(r.measured_on)}</span>
                  <span className="block text-xs text-muted">{SOURCE[r.source] ?? r.source}</span>
                </span>
                <span className="text-right tabular-nums">
                  {r.weight_kg !== null && <span className="block font-medium">{num(r.weight_kg, 1)} kg</span>}
                  <span className="block text-xs text-muted">
                    {[r.body_fat_pct !== null ? `Fat ${num(r.body_fat_pct, 1)}%` : null, r.muscle_mass_kg !== null ? `Muscle ${num(r.muscle_mass_kg, 1)} kg` : null, r.waist_cm !== null ? `Waist ${num(r.waist_cm)} cm` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-4 text-sm text-muted">No measurements yet.</p>
        )}
      </Card>
    </div>
  );
}
