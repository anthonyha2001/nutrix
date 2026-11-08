import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/patient-i18n";
import type { SavedContent, SavedItem } from "@/lib/nutrition";

// Confirmed Arabic names for these foods (the practice's own naming wins over
// the library's). Foods without one keep their original name.
export async function foodNames(foodIds: string[], lang: Lang): Promise<Map<string, string>> {
  const ids = [...new Set(foodIds)].filter(Boolean);
  if (lang === "en" || !ids.length) return new Map();
  const { data } = await (await createClient()).from("food_translations").select("food_id, name, practice_id").eq("lang", lang).in("food_id", ids);
  const out = new Map<string, string>();
  for (const r of (data ?? []).sort((a, b) => Number(Boolean(a.practice_id)) - Number(Boolean(b.practice_id)))) out.set(r.food_id, r.name);
  return out;
}

export function contentFoodIds(content: SavedContent) {
  const ids: string[] = [];
  for (const d of content.days) for (const m of d.meals) for (const it of m.items) ids.push(it.food_id, ...(it.alternatives ?? []).map((a) => a.food_id));
  return ids;
}

// A copy of the plan with food names in the patient's language.
export function translateContent(content: SavedContent, names: Map<string, string>): SavedContent {
  if (!names.size) return content;
  const item = (i: SavedItem): SavedItem => ({ ...i, name: names.get(i.food_id) ?? i.name, alternatives: i.alternatives?.map(item) });
  return { ...content, days: content.days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, items: m.items.map(item) })) })) };
}
