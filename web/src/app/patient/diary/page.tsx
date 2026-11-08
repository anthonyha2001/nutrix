import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { MacroSummary } from "@/components/macro-summary";
import { RecipeIngredients } from "@/components/recipe-ingredients";
import { Card } from "@/components/ui";
import { hasFeature } from "@/lib/features";
import { foodNames } from "@/lib/food-names";
import { todayIn } from "@/lib/format";
import { round, sumMacros, type MealSlot } from "@/lib/nutrition";
import { weightIn } from "@/lib/plan-i18n";
import { shortDayIn } from "@/lib/patient-i18n";
import { patientText } from "@/lib/patient-lang";
import { activePlan } from "@/lib/patient-plan";
import { recipeDetails, scaleRecipe } from "@/lib/recipes";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/time";
import { deleteEntry } from "../actions";
import { DiaryAdd } from "../widgets";

export const metadata: Metadata = { title: "Diary" };

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export default async function DiaryPage({ searchParams }: PageProps<"/patient/diary">) {
  const { viewer, link } = await requirePatient();
  if (!(await hasFeature(link.practiceId, "patient_diary"))) redirect("/patient");
  const { lang, t } = await patientText(viewer);
  const { d } = await searchParams;
  const today = todayIn(link.timezone);
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && d >= addDays(today, -30) ? d : today;
  const [plan, { data: entries }] = await Promise.all([
    activePlan(link.patientId),
    (await createClient()).from("diary_entries").select("*").eq("patient_id", link.patientId).eq("eaten_on", date).order("created_at"),
  ]);
  const foodIds = (entries ?? []).map((e) => e.food_id).filter((x): x is string => Boolean(x));
  const recipes = await recipeDetails(foodIds);
  const names = await foodNames([...foodIds, ...[...recipes.values()].flatMap((r) => r.ingredients.map((i) => i.food_id))], lang);

  const totals = sumMacros((entries ?? []).map((e) => ({ kcal: Number(e.kcal), protein_g: Number(e.protein_g), carbs_g: Number(e.carbs_g), fat_g: Number(e.fat_g), fiber_g: Number(e.fiber_g ?? 0) })));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: link.timezone }).format(new Date()));
  const defaultSlot: MealSlot = hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 21 ? "dinner" : "snack";
  // In Arabic the "previous" arrow points right (reading order).
  const Back = t.dir === "rtl" ? ChevronRight : ChevronLeft;
  const Forward = t.dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/patient/diary?d=${addDays(date, -1)}`} aria-label={t.diary.prev} className="grid size-10 place-items-center rounded-full hover:bg-surface">
          <Back className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">{date === today ? t.diary.today : shortDayIn(date, lang)}</h1>
        {date < today ? (
          <Link href={`/patient/diary?d=${addDays(date, 1)}`} aria-label={t.diary.next} className="grid size-10 place-items-center rounded-full hover:bg-surface">
            <Forward className="size-5" />
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </div>

      <Card className="rounded-2xl p-5">
        <MacroSummary totals={totals} targets={plan?.targets} compact neutral lang={lang} />
      </Card>

      <DiaryAdd date={date} defaultSlot={date === today ? defaultSlot : "lunch"} lang={lang} />

      {SLOTS.map((slot) => {
        const items = (entries ?? []).filter((e) => e.slot === slot);
        return (
          <Card key={slot} className="rounded-2xl">
            <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
              <h2 className="font-semibold">{t.slots[slot]}</h2>
              <span className="text-sm text-muted tabular-nums">
                {round(items.reduce((a, e) => a + Number(e.kcal), 0))} {t.macros.kcal}
              </span>
            </div>
            {items.length ? (
              <ul className="divide-y divide-line px-5 pb-2">
                {items.map((e) => {
                  const name = (e.food_id && names.get(e.food_id)) || e.name;
                  const recipe = e.food_id ? recipes.get(e.food_id) : undefined;
                  return (
                    <li key={e.id} className="py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <bdi className="block text-sm">{name}</bdi>
                          <span className="block text-xs text-muted tabular-nums">
                            {weightIn(Number(e.grams), lang)} · {round(Number(e.kcal))} {t.macros.kcal}
                          </span>
                        </span>
                        <ActionButton action={deleteEntry.bind(null, e.id)} variant="ghost" className="h-8 px-2" confirm={t.diary.remove(name)} danger>
                          <X className="size-4" aria-label={t.diary.removeLabel} />
                        </ActionButton>
                      </div>
                      {recipe && (
                        <RecipeIngredients
                          title={t.recipe.eaten}
                          lang={lang}
                          ingredients={scaleRecipe(recipe, Number(e.grams)).map((x) => ({ ...x, name: names.get(x.food_id) ?? x.name }))}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 pb-4 text-sm text-muted">{t.diary.nothing}</p>
            )}
          </Card>
        );
      })}
      <p className="text-center text-xs text-muted">{t.diary.footer}</p>
    </div>
  );
}
