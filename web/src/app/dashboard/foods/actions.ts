"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import type { Json } from "@/lib/supabase/database.types";

const ALLERGENS = ["gluten", "dairy", "egg", "peanut", "tree_nut", "sesame", "soy", "fish", "shellfish"];

function decimal(formData: FormData, key: string, { required = false, max = 100 } = {}) {
  const raw = text(formData, key).replace(",", ".");
  if (!raw) return required ? NaN : null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : NaN;
}

// A practice's own food, from a label (values per 100 g).
export async function saveFood(foodId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  const name = text(formData, "name");
  if (!name) return { error: "Enter the food's name." };
  const kcal = decimal(formData, "kcal", { required: true, max: 950 });
  const protein = decimal(formData, "protein_g", { required: true });
  const carbs = decimal(formData, "carbs_g", { required: true });
  const fat = decimal(formData, "fat_g", { required: true });
  const fiber = decimal(formData, "fiber_g");
  const sugar = decimal(formData, "sugar_g");
  const sodium = decimal(formData, "sodium_mg", { max: 100000 });
  if ([kcal, protein, carbs, fat, fiber, sugar, sodium].some((v) => Number.isNaN(v))) {
    return { error: "Check the numbers: energy, protein, carbs and fat are required, per 100 g." };
  }
  if ((protein ?? 0) + (carbs ?? 0) + (fat ?? 0) > 100) return { error: "Protein, carbs and fat can't add up to more than 100 g per 100 g." };

  const labels = formData.getAll("serving_label").map(String);
  const grams = formData.getAll("serving_grams").map((g) => Number(String(g).replace(",", ".")));
  const servings = labels.map((label, i) => ({ label: label.trim(), grams: grams[i] })).filter((s) => s.label && s.grams > 0);

  const { error } = await (await createClient()).rpc("save_food", {
    p_practice_id: membership.practiceId,
    p_id: foodId ?? undefined,
    p_name: name,
    p_brand: text(formData, "brand"),
    p_category: text(formData, "category"),
    p_kcal: kcal!,
    p_protein: protein!,
    p_carbs: carbs!,
    p_fat: fat!,
    p_fiber: fiber ?? undefined,
    p_sugar: sugar ?? undefined,
    p_sodium: sodium ?? undefined,
    p_allergens: formData.getAll("allergens").map(String).filter((a) => ALLERGENS.includes(a)),
    p_servings: servings as Json,
  });
  return error ? { error: errorMessage(error, "Couldn't save the food.") } : done(foodId ? "Food saved" : "Food added");
}

export type RecipeInput = {
  name: string;
  category: string;
  servings: number | null;
  yieldG: number | null;
  instructions: string;
  ingredients: { food_id: string; grams: number; note?: string }[];
};

export async function saveRecipe(recipeId: string | null, input: RecipeInput): Promise<ActionState> {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  if (!input.name.trim()) return { error: "Give the recipe a name." };
  if (!input.ingredients.length) return { error: "Add at least one ingredient." };
  if (input.ingredients.some((i) => !(i.grams > 0))) return { error: "Every ingredient needs a weight in grams." };
  const { error } = await (await createClient()).rpc("save_recipe", {
    p_practice_id: membership.practiceId,
    p_id: recipeId ?? undefined,
    p_name: input.name,
    p_category: input.category,
    p_yield_g: input.yieldG && input.yieldG > 0 ? input.yieldG : undefined,
    p_servings: input.servings && input.servings > 0 ? Math.round(input.servings) : undefined,
    p_instructions: input.instructions,
    p_ingredients: input.ingredients as Json,
  });
  return error ? { error: errorMessage(error, "Couldn't save the recipe.") } : done(recipeId ? "Recipe saved" : "Recipe added");
}

export async function copyRecipe(recipeId: string): Promise<ActionState> {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  const { data, error } = await (await createClient()).rpc("copy_recipe", { p_practice_id: membership.practiceId, p_recipe_id: recipeId });
  if (error) return { error: errorMessage(error, "Couldn't copy the recipe.") };
  redirect(`/dashboard/foods?tab=mine&recipe=${data}`);
}

export async function archiveFood(foodId: string): Promise<ActionState> {
  await requireStaff(CLINICAL_ROLES);
  const { error, count } = await (await createClient())
    .from("foods")
    .update({ archived_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", foodId);
  if (error) return { error: errorMessage(error) };
  return count ? done("Removed from your foods. Plans that use it keep their numbers.") : { error: "Only your practice's foods can be removed." };
}
