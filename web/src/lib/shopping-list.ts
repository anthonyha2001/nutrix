// A shopping list summed from a saved plan. Client-safe and pure.
//
// Plans of up to 7 days are taken to repeat through the week, so the list is
// for 7 days; longer plans are listed for their whole length. Approved swaps
// are left out (the patient eats one or the other). Amounts are as eaten, so
// cooked foods are listed at their cooked weight.

import type { SavedContent } from "./nutrition";

export type ShoppingItem = { name: string; grams: number; servings: { label: string; qty: number } | null };

export function shoppingList(content: SavedContent): { days: number; items: ShoppingItem[] } {
  const n = content.days.length;
  if (n === 0) return { days: 0, items: [] };
  const scale = n <= 7 ? 7 / n : 1;
  const days = n <= 7 ? 7 : n;

  const byFood = new Map<string, { name: string; grams: number; label: string | null | undefined; qty: number }>();
  for (const d of content.days) {
    for (const m of d.meals) {
      for (const it of m.items) {
        const cur = byFood.get(it.food_id) ?? { name: it.name, grams: 0, label: undefined, qty: 0 };
        cur.grams += Number(it.grams) * scale;
        // Count in servings only while every use is the same serving ("2 slices").
        const label = it.serving?.label ?? null;
        if (cur.label === undefined) cur.label = label;
        else if (cur.label !== label) cur.label = null;
        if (label && it.serving) cur.qty += Number(it.serving.qty) * scale;
        byFood.set(it.food_id, cur);
      }
    }
  }
  const items = [...byFood.values()]
    .map((f) => ({ name: f.name, grams: f.grams, servings: f.label ? { label: f.label, qty: f.qty } : null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { days, items };
}

// "1.3 kg", "450 g", "about 14 x slice (420 g)".
export function shoppingAmount(item: ShoppingItem) {
  const g = item.grams >= 1000 ? `${(Math.round(item.grams / 100) / 10).toLocaleString("en-US")} kg` : `${Math.round(item.grams / 5) * 5 || Math.round(item.grams)} g`;
  if (!item.servings) return g;
  const qty = Math.round(item.servings.qty * 2) / 2;
  return `${qty.toLocaleString("en-US")} x ${item.servings.label.replace(/^1\s+/, "")} (${g})`;
}
