import type { Metadata } from "next";
import { TrendChart } from "@/components/trend-chart";
import { Card } from "@/components/ui";
import { num, todayIn } from "@/lib/format";
import { formatDateIn } from "@/lib/patient-i18n";
import { patientText } from "@/lib/patient-lang";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { WeightForm } from "../widgets";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const { viewer, link } = await requirePatient();
  const { lang, t } = await patientText(viewer);
  const { data: rows } = await (await createClient())
    .from("measurements")
    .select("id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, source")
    .eq("patient_id", link.patientId)
    .order("measured_on")
    .order("created_at");
  const weights = (rows ?? []).filter((r) => r.weight_kg !== null);

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t.progress.title}</h1>
      <Card className="rounded-2xl p-5">
        <p className="mb-3 font-semibold">{t.progress.record}</p>
        <WeightForm today={todayIn(link.timezone)} lang={lang} />
      </Card>
      {weights.length > 1 && (
        // Charts read left to right (time) in both languages.
        <Card className="rounded-2xl p-4" dir="ltr">
          <TrendChart title={t.progress.chart} unit={t.progress.kg} points={weights.map((w) => ({ date: w.measured_on, value: Number(w.weight_kg) }))} />
        </Card>
      )}
      <Card className="rounded-2xl">
        <p className="px-5 pt-4 pb-2 font-semibold">{t.progress.history}</p>
        {rows?.length ? (
          <ul className="divide-y divide-line px-5 pb-2">
            {[...rows].reverse().map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="block">{formatDateIn(r.measured_on, lang)}</span>
                  <span className="block text-xs text-muted">{t.progress.sources[r.source] ?? r.source}</span>
                </span>
                <span className="text-end tabular-nums">
                  {r.weight_kg !== null && (
                    <span className="block font-medium">
                      {num(r.weight_kg, 1)} {t.progress.kg}
                    </span>
                  )}
                  <span className="block text-xs text-muted">
                    {[
                      r.body_fat_pct !== null ? t.progress.fat(num(r.body_fat_pct, 1)) : null,
                      r.muscle_mass_kg !== null ? t.progress.muscle(num(r.muscle_mass_kg, 1)) : null,
                      r.waist_cm !== null ? t.progress.waist(num(r.waist_cm)) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-4 text-sm text-muted">{t.progress.none}</p>
        )}
      </Card>
    </div>
  );
}
