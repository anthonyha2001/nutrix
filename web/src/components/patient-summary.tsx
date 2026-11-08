import { formatDate, num } from "@/lib/format";
import { ALLERGEN_LABELS } from "@/lib/nutrition";
import type { PatientSummary } from "@/lib/patient-summary";

// Pre-consultation summary: last 7 days at a glance.
export function PatientSummaryCard({ s }: { s: PatientSummary }) {
  const rows: [string, string][] = [
    ["Weight", s.latestWeight ? `${num(s.latestWeight.kg, 1)} kg (${formatDate(s.latestWeight.date)})${s.weightChange !== null ? `, ${s.weightChange > 0 ? "+" : ""}${num(s.weightChange, 1)} kg since the reading before` : ""}` : "No weigh-in yet"],
    ["Plan", s.plan ? `${s.plan.name}${s.plan.totals ? `, ${s.plan.totals.kcal} kcal/day` : ""}${s.plan.targets.kcal ? ` (target ${s.plan.targets.kcal})` : ""}` : "No active plan"],
    ["Diary, last 7 days", s.daysLogged ? `${s.daysLogged} of 7 days logged, about ${num(s.avgKcal)} kcal a day` : "Nothing logged"],
    ["Check-ins, last 7 days", s.checkIns ? `${s.checkIns} of 7${s.avgMood ? `, mood ${num(s.avgMood, 1)}/5` : ""}${s.avgFollowed ? `, followed the plan ${num(s.avgFollowed, 1)}/5` : ""}` : "None"],
    ["Water", s.avgWater ? `about ${num(s.avgWater / 1000, 1)} L a day` : "Not tracked"],
    ["Allergies", s.allergies.length ? s.allergies.map((a) => (a.allergen === "other" ? a.label : ALLERGEN_LABELS[a.allergen])).join(", ") : "None recorded"],
  ];
  return (
    <div className="rounded-xl bg-canvas p-4">
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Before the consultation</p>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-0.5 sm:grid-cols-[11rem_1fr]">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {s.lastNote && (
        <div className="mt-3 border-t border-line pt-3 text-sm">
          <p className="text-xs text-muted">Last note, {formatDate(s.lastNote.noted_on)}</p>
          <p className="line-clamp-3 whitespace-pre-line">{s.lastNote.title ? `${s.lastNote.title}: ` : ""}{s.lastNote.body}</p>
        </div>
      )}
    </div>
  );
}
