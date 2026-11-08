import type { Metadata } from "next";
import Link from "next/link";
import { MacroSummary } from "@/components/macro-summary";
import { MealDay } from "@/components/meal-day";
import { Card } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { dayIndexFor } from "@/lib/nutrition";
import { activePlan } from "@/lib/patient-plan";
import { requirePatient } from "@/lib/session";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const { link } = await requirePatient();
  const { plan, timezone } = await activePlan(link.patientId);
  const firstName = link.fullName.split(" ")[0];

  if (!plan) {
    return (
      <div className="stagger space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Hi {firstName}</h1>
        <Card className="rounded-2xl p-5">
          <p className="font-medium">No meal plan yet</p>
          <p className="mt-1 text-sm text-muted">Your dietitian will share your plan here after your consultation.</p>
        </Card>
      </div>
    );
  }

  const today = todayIn(timezone);
  const day = plan.content.days[dayIndexFor(plan.content, plan.starts_on, today)];

  return (
    <div className="stagger space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {firstName}</h1>
        <p className="text-sm text-muted">
          Today{plan.content.days.length > 1 ? `: ${day.label}` : ""} · {plan.name}
        </p>
      </div>
      <Card className="rounded-2xl p-5">
        <p className="mb-3 text-sm font-medium">Today&apos;s plan adds up to</p>
        <MacroSummary totals={day.totals} targets={plan.targets} compact neutral />
      </Card>
      <MealDay day={day} />
      {plan.notes && (
        <Card className="rounded-2xl p-5">
          <p className="text-sm font-medium">From your dietitian</p>
          <p className="mt-1 text-sm whitespace-pre-line text-muted">{plan.notes}</p>
        </Card>
      )}
      <Link href="/patient/plan" className="block text-center text-sm font-medium text-muted underline underline-offset-4 hover:text-ink">
        See the whole plan
      </Link>
    </div>
  );
}
