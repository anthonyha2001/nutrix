import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { MacroSummary } from "@/components/macro-summary";
import { MealDay } from "@/components/meal-day";
import { Card } from "@/components/ui";
import { dayName, formatDateIn } from "@/lib/patient-i18n";
import { patientText } from "@/lib/patient-lang";
import { localizedPlan } from "@/lib/patient-plan";
import { requirePatient } from "@/lib/session";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage() {
  const { viewer, link } = await requirePatient();
  const { lang, t } = await patientText(viewer);
  const { plan, recipes, recipeNames } = await localizedPlan(link.patientId, lang);

  if (!plan) {
    return (
      <div className="stagger space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.plan.title}</h1>
        <Card className="rounded-2xl p-5">
          <p className="text-sm text-muted">{t.plan.none}</p>
        </Card>
      </div>
    );
  }

  const multi = plan.content.days.length > 1;
  return (
    <div className="stagger space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <bdi>{plan.name}</bdi>
        </h1>
        <p className="text-sm text-muted">
          {plan.starts_on ? t.plan.from(formatDateIn(plan.starts_on, lang)) : ""}
          {plan.ends_on ? t.plan.to(formatDateIn(plan.ends_on, lang)) : ""}
        </p>
      </div>
      {plan.content.totals && (
        <Card className="rounded-2xl p-5">
          <p className="mb-3 text-sm font-medium">{multi ? t.plan.average : t.plan.each}</p>
          <MacroSummary totals={plan.content.totals} targets={plan.targets} compact neutral lang={lang} />
        </Card>
      )}
      <Link href="/patient/shopping" className="lift flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-sm font-medium hover:border-ink/20">
        <ShoppingBasket className="size-5 text-brand-strong" />
        {t.plan.shoppingLink}
      </Link>
      {multi ? (
        plan.content.days.map((d, i) => (
          <details key={i} open={i === 0} className="group rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold">
              {dayName(d.label, lang)}
              <span className="text-sm font-normal text-muted tabular-nums">
                {d.totals.kcal} {t.macros.kcal}
              </span>
            </summary>
            <div className="px-3 pb-3">
              <MealDay day={d} lang={lang} recipes={recipes} recipeNames={recipeNames} />
            </div>
          </details>
        ))
      ) : (
        <MealDay day={plan.content.days[0]} lang={lang} recipes={recipes} recipeNames={recipeNames} />
      )}
      <p className="text-center text-xs text-muted">{t.plan.swapsNote}</p>
    </div>
  );
}
