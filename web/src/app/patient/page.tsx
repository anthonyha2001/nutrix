import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { MacroSummary } from "@/components/macro-summary";
import { MealDay } from "@/components/meal-day";
import { Card } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { dayIndexFor, sumMacros } from "@/lib/nutrition";
import { activePlan } from "@/lib/patient-plan";
import { hasFeature } from "@/lib/features";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatWhen } from "@/lib/time";
import { CheckinCard, LogMealButton, WaterCard } from "./widgets";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const { link } = await requirePatient();
  const today = todayIn(link.timezone);
  const supabase = await createClient();
  const [diaryOn, plan, { data: entries }, { data: checkin }, { data: next }] = await Promise.all([
    hasFeature(link.practiceId, "patient_diary"),
    activePlan(link.patientId),
    supabase.from("diary_entries").select("kcal, protein_g, carbs_g, fat_g, fiber_g, plan_meal_key").eq("patient_id", link.patientId).eq("eaten_on", today),
    supabase.from("daily_checkins").select("*").eq("patient_id", link.patientId).eq("day", today).maybeSingle(),
    supabase
      .from("appointments")
      .select("starts_at, status, online")
      .eq("patient_id", link.patientId)
      .in("status", ["requested", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ]);
  const firstName = link.fullName.split(" ")[0];
  const eaten = sumMacros(
    (entries ?? []).map((e) => ({ kcal: Number(e.kcal), protein_g: Number(e.protein_g), carbs_g: Number(e.carbs_g), fat_g: Number(e.fat_g), fiber_g: Number(e.fiber_g ?? 0) })),
  );
  const loggedMeals = new Set((entries ?? []).map((e) => e.plan_meal_key).filter(Boolean));
  const day = plan ? plan.content.days[dayIndexFor(plan.content, plan.starts_on, today)] : null;

  return (
    <div className="stagger space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {firstName}</h1>
        <p className="text-sm text-muted">{plan ? `${plan.name}${plan.content.days.length > 1 && day ? ` · ${day.label}` : ""}` : link.practiceName}</p>
      </div>

      <Card className="rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Eaten today</p>
          <Link href="/patient/diary" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
            Diary
          </Link>
        </div>
        <MacroSummary totals={eaten} targets={plan?.targets.kcal ? plan.targets : day?.totals} compact neutral />
      </Card>

      {next && (
        <Link href="/patient/appointments" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <span className="grid size-10 place-items-center rounded-full bg-canvas">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{next.status === "requested" ? "Requested appointment" : "Next appointment"}</span>
            <span className="block text-sm text-muted">
              {formatWhen(next.starts_at, link.timezone)}
              {next.online ? " · Online" : ""}
            </span>
          </span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}

      {diaryOn && (
      <div className="grid gap-4 sm:grid-cols-2">
        <WaterCard date={today} ml={checkin?.water_ml ?? 0} />
        <CheckinCard date={today} checkin={checkin ? { ...checkin, sleep_hours: checkin.sleep_hours === null ? null : Number(checkin.sleep_hours), checked_in: Boolean(checkin.checked_in_at) } : null} />
      </div>
      )}

      {day ? (
        <>
          <h2 className="pt-2 font-semibold">Today&apos;s meals</h2>
          <MealDay day={day} action={diaryOn ? (meal) => <LogMealButton date={today} meal={meal} logged={loggedMeals.has(meal.key)} /> : undefined} />
        </>
      ) : (
        <Card className="rounded-2xl p-5">
          <p className="font-medium">No meal plan yet</p>
          <p className="mt-1 text-sm text-muted">Your dietitian will share your plan here. Meanwhile you can log what you eat in the Diary.</p>
        </Card>
      )}
      {plan?.notes && (
        <Card className="rounded-2xl p-5">
          <p className="text-sm font-medium">From your dietitian</p>
          <p className="mt-1 text-sm whitespace-pre-line text-muted">{plan.notes}</p>
        </Card>
      )}
    </div>
  );
}
