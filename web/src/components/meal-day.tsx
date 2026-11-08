import type { ReactNode } from "react";
import { Repeat } from "lucide-react";
import { RecipeIngredients } from "@/components/recipe-ingredients";
import { Card } from "@/components/ui";
import { amountLabel, round, type SavedDay, type SavedMeal } from "@/lib/nutrition";
import { amountIn } from "@/lib/plan-i18n";
import { PATIENT_TEXT, type Lang } from "@/lib/patient-i18n";
import { scaleRecipe, type RecipeDetail } from "@/lib/recipes";

// One day of a saved plan, read-only (patient app). Names should already be in
// the patient's language; `recipes` adds the ingredients under recipe foods.
export function MealDay({
  day,
  action,
  lang = "en",
  recipes,
  recipeNames,
}: {
  day: SavedDay;
  action?: (meal: SavedMeal) => ReactNode;
  lang?: Lang;
  recipes?: Map<string, RecipeDetail>;
  recipeNames?: Map<string, string>;
}) {
  const t = PATIENT_TEXT[lang];
  const amount = (i: { grams: number; serving?: { label: string; qty: number } | null }) => (lang === "en" ? amountLabel(i) : amountIn(i, lang));
  return (
    <div className="space-y-3">
      {day.meals.map((meal) => (
        <Card key={meal.key} className="rounded-2xl">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
            <h3 className="font-semibold">
              {meal.name || t.slots[meal.slot]}
              {meal.name && <span className="ms-2 text-sm font-normal text-muted">{t.slots[meal.slot]}</span>}
            </h3>
            <span className="shrink-0 text-sm text-muted tabular-nums">
              {meal.time ? `${meal.time} · ` : ""}
              {round(meal.totals.kcal)} {t.macros.kcal}
            </span>
          </div>
          <ul className="divide-y divide-line px-5 pb-2">
            {meal.items.map((item, i) => {
              const recipe = recipes?.get(item.food_id);
              return (
                <li key={`${item.food_id}-${i}`} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <bdi className="text-sm">{item.name}</bdi>
                    <span className="shrink-0 text-end text-sm text-muted tabular-nums">{amount(item)}</span>
                  </div>
                  {item.alternatives && item.alternatives.length > 0 && (
                    <p className="mt-1 flex gap-1.5 text-xs text-muted">
                      <Repeat className="mt-0.5 size-3 shrink-0" />
                      <span>
                        {t.plan.or}:{" "}
                        {item.alternatives.map((a, n) => (
                          <span key={`${a.food_id}-${n}`}>
                            {n > 0 && (lang === "ar" ? "، " : "; ")}
                            <bdi>{a.name}</bdi> ({amount(a)})
                          </span>
                        ))}
                      </span>
                    </p>
                  )}
                  {recipe && (
                    <RecipeIngredients
                      title={t.recipe.portion}
                      lang={lang}
                      ingredients={scaleRecipe(recipe, Number(item.grams)).map((x) => ({ ...x, name: recipeNames?.get(x.food_id) ?? x.name }))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {meal.notes && <p className="px-5 pb-4 text-sm text-muted">{meal.notes}</p>}
          {action && meal.items.length > 0 && <div className="flex justify-end border-t border-line px-4 py-2.5">{action(meal)}</div>}
        </Card>
      ))}
    </div>
  );
}
