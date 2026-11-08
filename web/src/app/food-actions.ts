"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import type { FoodHit } from "@/lib/nutrition";

// Food search for the plan builder and the recipe editor. Row-level security
// limits results to the shared library and the caller's practice.
export async function searchFoods(query: string, limit = 25): Promise<FoodHit[]> {
  await requireStaff();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data: foods } = await supabase.rpc("search_foods", { p_query: q, p_limit: limit });
  if (!foods?.length) return [];
  const { data: servings } = await supabase
    .from("food_servings")
    .select("food_id, label, grams, sort")
    .in("food_id", foods.map((f) => f.id))
    .order("sort");
  return foods.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    brand: f.brand,
    is_recipe: f.is_recipe,
    source: f.source,
    kcal: Number(f.kcal),
    protein_g: Number(f.protein_g),
    carbs_g: Number(f.carbs_g),
    fat_g: Number(f.fat_g),
    fiber_g: f.fiber_g === null ? null : Number(f.fiber_g),
    allergens: f.allergens,
    servings: (servings ?? []).filter((s) => s.food_id === f.id).map((s) => ({ label: s.label, grams: Number(s.grams) })),
  }));
}
