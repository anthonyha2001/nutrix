import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RecipeIngredient = { food_id: string; name: string; grams: number; note: string | null; category: string };
export type RecipeDetail = { total: number; ingredients: RecipeIngredient[] };

// Ingredients of the recipes among these foods, with each recipe's total
// weight (cooked weight when set, else the sum of its ingredients), so an
// amount eaten can be turned into the ingredients to cook it.
export async function recipeDetails(foodIds: string[]): Promise<Map<string, RecipeDetail>> {
  const ids = [...new Set(foodIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const supabase = await createClient();
  const { data: recipes } = await supabase.from("foods").select("id, recipe_yield_g").in("id", ids).eq("is_recipe", true);
  if (!recipes?.length) return new Map();
  const { data: rows } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, grams, note, sort, food:foods!recipe_ingredients_food_id_fkey(id, name, category)")
    .in("recipe_id", recipes.map((r) => r.id))
    .order("sort");
  const out = new Map<string, RecipeDetail>();
  for (const r of recipes) {
    const ingredients = (rows ?? [])
      .filter((x) => x.recipe_id === r.id && x.food)
      .map((x) => ({ food_id: x.food!.id, name: x.food!.name, grams: Number(x.grams), note: x.note, category: x.food!.category }));
    const raw = ingredients.reduce((a, i) => a + i.grams, 0);
    out.set(r.id, { total: Number(r.recipe_yield_g) || raw, ingredients });
  }
  return out;
}

// The ingredients for `grams` of the recipe.
export function scaleRecipe(detail: RecipeDetail, grams: number): RecipeIngredient[] {
  const f = detail.total > 0 ? grams / detail.total : 0;
  return detail.ingredients.map((i) => ({ ...i, grams: i.grams * f }));
}
