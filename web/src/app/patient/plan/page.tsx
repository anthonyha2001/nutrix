import type { Metadata } from "next";
import { MacroSummary } from "@/components/macro-summary";
import { MealDay } from "@/components/meal-day";
import { Card } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { activePlan } from "@/lib/patient-plan";
import { requirePatient } from "@/lib/session";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage() {
  const { link } = await requirePatient();
  const plan = await activePlan(link.patientId);

  if (!plan) {
    return (
      <div className="stagger space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
        <Card className="rounded-2xl p-5">
          <p className="text-sm text-muted">Your dietitian hasn&apos;t shared a meal plan yet.</p>
        </Card>
      </div>
    );
  }

  const multi = plan.content.days.length > 1;
  return (
    <div className="stagger space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
        <p className="text-sm text-muted">
          {plan.starts_on ? `From ${formatDate(plan.starts_on)}` : ""}
          {plan.ends_on ? ` to ${formatDate(plan.ends_on)}` : ""}
        </p>
      </div>
      {plan.content.totals && (
        <Card className="rounded-2xl p-5">
          <p className="mb-3 text-sm font-medium">{multi ? "An average day" : "Each day"}</p>
          <MacroSummary totals={plan.content.totals} targets={plan.targets} compact neutral />
        </Card>
      )}
      {multi ? (
        plan.content.days.map((d, i) => (
          <details key={i} open={i === 0} className="group rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold">
              {d.label}
              <span className="text-sm font-normal text-muted tabular-nums">{d.totals.kcal} kcal</span>
            </summary>
            <div className="px-3 pb-3">
              <MealDay day={d} />
            </div>
          </details>
        ))
      ) : (
        <MealDay day={plan.content.days[0]} />
      )}
      <p className="text-center text-xs text-muted">Swaps marked &quot;Or&quot; are approved by your dietitian.</p>
    </div>
  );
}
