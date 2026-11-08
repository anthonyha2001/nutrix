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
export async function searchFoods(query: string, limit = 25, lang: "en" | "ar" = "en"): Promise<FoodHit[]> {
  // Staff and patients; row-level security limits what each can find.
  await requireViewer();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const supabase = await createClient();
  // Arabic typing searches the confirmed Arabic names.
  if (/[؀-ۿ]/.test(q)) {
    const { data: names } = await supabase.from("food_translations").select("food_id, name").eq("lang", "ar").ilike("name", `%${q.replace(/[%_\]/g, "")}%`).limit(limit);
    const ids = [...new Set((names ?? []).map((n) => n.food_id))];
    if (!ids.length) return [];
    const { data: foods } = await supabase.from("foods").select("*").in("id", ids).is("archived_at", null);
    const hits = await withServings(foods ?? []);
    return hits.map((h) => ({ ...h, alt_name: h.name, name: names!.find((n) => n.food_id === h.id)?.name ?? h.name }));
  }
  const { data: foods } = await supabase.rpc("search_foods", { p_query: q, p_limit: limit });
  const hits = await withServings(foods ?? []);
  if (lang !== "ar" || !hits.length) return hits;
  // Patients reading Arabic: confirmed Arabic names first, the original underneath.
  const { data: names } = await supabase.from("food_translations").select("food_id, name, practice_id").eq("lang", "ar").in("food_id", hits.map((h) => h.id));
  const ar = new Map<string, string>();
  for (const n of (names ?? []).sort((a, b) => Number(Boolean(a.practice_id)) - Number(Boolean(b.practice_id)))) ar.set(n.food_id, n.name);
  return hits.map((h) => (ar.has(h.id) ? { ...h, alt_name: h.name, name: ar.get(h.id)! } : h));
}

export type SwapSuggestion = { food: FoodHit; grams: number };

// Foods that could stand in for `foodId` at about the same energy: same
// category, closest balance of protein, carbs and fat, none of the patient's
// allergens. Each comes with the amount that matches `kcal`. Generic foods and
// the practice's own foods only (packaged products are too many and too alike).
export async function suggestSwaps(foodId: string, kcal: number, avoid: string[] = []): Promise<SwapSuggestion[]> {
  await requireViewer();
  const supabase = await createClient();
  const { data: food } = await supabase.from("foods").select("id, name, category, kcal, protein_g, carbs_g, fat_g").eq("id", foodId).maybeSingle();
  if (!food || !(kcal > 0)) return [];
  const { data: candidates } = await supabase
    .from("foods")
    .select("id, name, category, brand, is_recipe, source, kcal, protein_g, carbs_g, fat_g, fiber_g, allergens")
    .eq("category", food.category)
    .eq("branded", false)
    .is("archived_at", null)
    .neq("id", foodId)
    .gt("kcal", 5)
    .limit(600);

  const share = (f: { protein_g: number; carbs_g: number; fat_g: number }) => {
    const p = Number(f.protein_g) * 4, c = Number(f.carbs_g) * 4, fat = Number(f.fat_g) * 9;
    const t = p + c + fat || 1;
    return [p / t, c / t, fat / t];
  };
  const target = share(food);
  // "Chicken breast, roasted" and "Chicken breast, grilled" aren't real alternatives to each other.
  const stem = (name: string) => name.toLowerCase().split(/[,(]/)[0].trim().split(/\s+/).slice(0, 2).join(" ");
  const own = stem(food.name);
  // Cooked rice shouldn't be swapped for flour, nor a ready food for a dry mix.
  const state = (name: string) =>
    /\b(raw|dry|dried|uncooked|unprepared|flour|meal|crude|powder|mix|dehydrated|concentrate)\b/i.test(name)
      ? "raw"
      : /\b(cooked|boiled|baked|roasted|grilled|broiled|fried|steamed|stewed|braised|prepared|toasted|canned|ready-to-eat|rotisserie)\b/i.test(name)
        ? "cooked"
        : "any";
  const ownState = state(food.name);
  const baseGrams = (kcal / Number(food.kcal)) * 100;

  const seen = new Set<string>([own]);
  const ranked = (candidates ?? [])
    .filter((c) => !c.allergens.some((a) => avoid.includes(a)))
    .map((c) => {
      const s = share(c);
      const balance = Math.abs(s[0] - target[0]) + Math.abs(s[1] - target[1]) + Math.abs(s[2] - target[2]);
      // Similar energy density gives a similar-looking portion.
      const density = Math.abs(Math.log(Number(c.kcal) / Number(food.kcal)));
      const cs = state(c.name);
      const mismatch = ownState !== "any" && cs !== "any" && cs !== ownState;
      const grams = Math.round(((kcal / Number(c.kcal)) * 100) / 5) * 5;
      return { c, distance: balance + 0.35 * density, grams, mismatch };
    })
    .filter((x) => !x.mismatch && x.grams >= 5 && x.grams <= 600 && x.grams >= baseGrams / 3 && x.grams <= baseGrams * 3)
    .sort((a, b) => a.distance - b.distance || a.c.name.length - b.c.name.length)
    .filter((x) => {
      const k = stem(x.c.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
  const hits = await withServings(ranked.map((x) => x.c));
  return hits.map((h, i) => ({ food: h, grams: ranked[i].grams }));
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

// Quick typing: the best matches for several typed names at once (up to 5 each).
export async function quickFindFoods(names: string[]): Promise<FoodHit[][]> {
  await requireViewer();
  const supabase = await createClient();
  const list = names.slice(0, 20).map((n) => n.trim().slice(0, 80));
  return Promise.all(
    list.map(async (q) => {
      if (q.length < 2) return [];
      const { data } = await supabase.rpc("search_foods", { p_query: q, p_limit: 5 });
      return withServings(data ?? []);
    }),
  );
}
