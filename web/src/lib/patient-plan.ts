import "server-only";
import { contentFoodIds, foodNames, translateContent } from "@/lib/food-names";
import type { SavedContent, Targets } from "@/lib/nutrition";
import type { Lang } from "@/lib/patient-i18n";
import { recipeDetails } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";

// The patient's active plan, if their dietitian has given them one.
export async function activePlan(patientId: string) {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, name, starts_on, ends_on, notes, targets, content")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();
  return plan ? { ...plan, content: plan.content as SavedContent, targets: plan.targets as Targets } : null;
}

// The active plan as the patient reads it: food names in their language, and
// the ingredients of any recipe in it (with those names translated too).
export async function localizedPlan(patientId: string, lang: Lang) {
  const plan = await activePlan(patientId);
  if (!plan) return { plan: null, recipes: new Map(), recipeNames: new Map<string, string>() };
  const ids = contentFoodIds(plan.content);
  const recipes = await recipeDetails(ids);
  const ingredientIds = [...recipes.values()].flatMap((r) => r.ingredients.map((i) => i.food_id));
  const names = await foodNames([...ids, ...ingredientIds], lang);
  return { plan: { ...plan, content: translateContent(plan.content, names) }, recipes, recipeNames: names };
}
