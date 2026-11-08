"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireViewer } from "@/lib/session";
import { isBarcode, lookupBarcode, searchOnline, type OnlineFood } from "@/lib/openfoodfacts";
import type { FoodHit } from "@/lib/nutrition";

type FoodRow = {
  id: string; name: string; category: string; brand: string | null; is_recipe: boolean; source: FoodHit["source"];
  kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null; allergens: string[];
};

async function withServings(foods: FoodRow[]): Promise<FoodHit[]> {
  if (!foods.length) return [];
  const supabase = await createClient();
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

// Food search for the plan builder, the diary and the recipe editor. Row-level
// security limits results to the shared library and the caller's practice.
export async function searchFoods(query: string, limit = 25): Promise<FoodHit[]> {
  // Staff and patients; row-level security limits what each can find.
  await requireViewer();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data: foods } = await supabase.rpc("search_foods", { p_query: q, p_limit: limit });
  return withServings(foods ?? []);
}

// Saving a looked-up product needs the server's service key. Without it the
// online search is hidden, since its results couldn't be used.
function onlineEnabled() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
}

const toHit = (f: OnlineFood): FoodHit => ({
  id: `off:${f.code}`,
  name: f.name,
  category: f.category,
  brand: f.brand,
  is_recipe: false,
  source: "openfoodfacts",
  kcal: f.kcal,
  protein_g: f.protein_g,
  carbs_g: f.carbs_g,
  fat_g: f.fat_g,
  fiber_g: f.fiber_g,
  allergens: f.allergens,
  servings: f.servings,
  online: f.code,
});

export type OnlineResult = { status: "ok"; hits: FoodHit[] } | { status: "off" } | { status: "error" };

// Open Food Facts products that aren't in the library yet. A barcode is looked
// up directly; words run a search (OFF allows only a few a minute, so the UI
// asks for it instead of searching on every keystroke).
export async function searchFoodsOnline(query: string): Promise<OnlineResult> {
  await requireViewer();
  if (!onlineEnabled()) return { status: "off" };
  const q = query.trim().slice(0, 80);
  try {
    const found = isBarcode(q) ? [await lookupBarcode(q)].filter((f): f is OnlineFood => f !== null) : await searchOnline(q);
    if (!found.length) return { status: "ok", hits: [] };
    // Leave out what is already stored; local search shows those.
    const supabase = await createClient();
    const { data: stored } = await supabase
      .from("foods")
      .select("source_ref")
      .eq("dataset", "openfoodfacts")
      .is("archived_at", null)
      .in("source_ref", found.map((f) => f.code));
    const have = new Set((stored ?? []).map((s) => s.source_ref));
    return { status: "ok", hits: found.filter((f) => !have.has(f.code)).map(toHit) };
  } catch {
    return { status: "error" };
  }
}

// Saves a product found online so it can go in a plan, recipe or diary. The
// server fetches the product again itself; nothing from the browser but the
// barcode is trusted.
export async function saveOnlineFood(code: string): Promise<FoodHit | null> {
  await requireViewer();
  if (!onlineEnabled() || !/^[0-9]{6,14}$/.test(code)) return null;
  let product: OnlineFood | null;
  try {
    product = await lookupBarcode(code);
  } catch {
    return null;
  }
  if (!product) return null;
  const admin = createAdminClient();
  const { data: id, error } = await admin.rpc("food_save_online", {
    p: {
      source_ref: product.code,
      name: product.name,
      brand: product.brand,
      category: product.category,
      kcal: product.kcal,
      protein_g: product.protein_g,
      carbs_g: product.carbs_g,
      fat_g: product.fat_g,
      fiber_g: product.fiber_g,
      sugar_g: product.sugar_g,
      sodium_mg: product.sodium_mg,
      allergens: product.allergens,
      servings: product.servings,
    },
  });
  if (error || !id) return null;
  const supabase = await createClient();
  const { data: food } = await supabase.from("foods").select("*").eq("id", id).maybeSingle();
  return food ? (await withServings([food]))[0] : null;
}
