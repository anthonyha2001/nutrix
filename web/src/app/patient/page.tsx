import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { MacroSummary } from "@/components/macro-summary";
import { MealDay } from "@/components/meal-day";
import { Card } from "@/components/ui";
import { hasFeature } from "@/lib/features";
import { todayIn } from "@/lib/format";
import { dayIndexFor, sumMacros } from "@/lib/nutrition";
import { dayName, formatWhenIn } from "@/lib/patient-i18n";
import { patientText } from "@/lib/patient-lang";
import { localizedPlan } from "@/lib/patient-plan";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CheckinCard, LogMealButton, RemindersCard, WaterCard } from "./widgets";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const { viewer, link } = await requirePatient();
  const { lang, t } = await patientText(viewer);
  const today = todayIn(link.timezone);
  const supabase = await createClient();
  const [diaryOn, { plan, recipes, recipeNames }, { data: entries }, { data: checkin }, { data: next }, { count: devices }] = await Promise.all([
    hasFeature(link.practiceId, "patient_diary"),
    localizedPlan(link.patientId, lang),
    supabase.from("diary_entries").select("kcal, protein_g, carbs_g, fat_g, fiber_g, plan_meal_key").eq("patient_id", link.patientId).eq("eaten_on", today),
    supabase.from("daily_checkins").select("*").eq("patient_id", link.patientId).eq("day", today).maybeSingle(),
    supabase.from("appointments").select("starts_at, status, online").eq("patient_id", link.patientId).in("status", ["requested", "confirmed"]).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle(),
    supabase.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("patient_id", link.patientId),
  ]);
  const firstName = link.fullName.split(" ")[0];
  const eaten = sumMacros((entries ?? []).map((e) => ({ kcal: Number(e.kcal), protein_g: Number(e.protein_g), carbs_g: Number(e.carbs_g), fat_g: Number(e.fat_g), fiber_g: Number(e.fiber_g ?? 0) })));
  const loggedMeals = new Set((entries ?? []).map((e) => e.plan_meal_key).filter(Boolean));
  const day = plan ? plan.content.days[dayIndexFor(plan.content, plan.starts_on, today)] : null;
  const Chevron = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="stagger space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.today.hi(firstName)}</h1>
        <p className="text-sm text-muted">
          {plan ? (
            <>
              <bdi>{plan.name}</bdi>
              {plan.content.days.length > 1 && day ? ` · ${dayName(day.label, lang)}` : ""}
            </>
          ) : (
            <bdi>{link.practiceName}</bdi>
          )}
        </p>
      </div>

      <Card className="rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">{t.today.eaten}</p>
          {diaryOn && (
            <Link href="/patient/diary" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
              {t.today.diaryLink}
            </Link>
          )}
        </div>
        <MacroSummary totals={eaten} targets={plan?.targets.kcal ? plan.targets : day?.totals} compact neutral lang={lang} />
      </Card>

      {next && (
        <Link href="/patient/appointments" className="lift flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <span className="grid size-10 place-items-center rounded-full bg-canvas">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{next.status === "requested" ? t.today.requested : t.today.next}</span>
            <span className="block text-sm text-muted">
              {formatWhenIn(next.starts_at, link.timezone, lang)}
              {next.online ? ` · ${t.today.online}` : ""}
            </span>
          </span>
          <Chevron className="size-4 text-muted" />
        </Link>
      )}

      {diaryOn && (
        <div className="grid gap-4 sm:grid-cols-2">
          <WaterCard date={today} ml={checkin?.water_ml ?? 0} lang={lang} />
          <CheckinCard
            date={today}
            lang={lang}
            checkin={checkin ? { ...checkin, sleep_hours: checkin.sleep_hours === null ? null : Number(checkin.sleep_hours), checked_in: Boolean(checkin.checked_in_at) } : null}
          />
        </div>
      )}

      {day ? (
        <>
          <h2 className="pt-2 font-semibold">{t.today.meals}</h2>
          <MealDay
            day={day}
            lang={lang}
            recipes={recipes}
            recipeNames={recipeNames}
            action={diaryOn ? (meal) => <LogMealButton date={today} meal={meal} logged={loggedMeals.has(meal.key)} lang={lang} /> : undefined}
          />
          {!devices && <RemindersCard lang={lang} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />}
        </>
      ) : (
        <Card className="rounded-2xl p-5">
          <p className="font-medium">{t.today.noPlanTitle}</p>
          <p className="mt-1 text-sm text-muted">{t.today.noPlanBody}</p>
        </Card>
      )}
      {plan?.notes && (
        <Card className="rounded-2xl p-5">
          <p className="text-sm font-medium">{t.today.fromDietitian}</p>
          <p className="mt-1 text-sm whitespace-pre-line text-muted">{plan.notes}</p>
        </Card>
      )}
    </div>
  );
}
