// Things worth a second look before a plan goes to the patient. Advice only:
// the dietitian can always give the plan anyway. Client-safe (runs live in the
// builder while editing).

import { ALLERGEN_LABELS, dayMacros, itemMacros, round, SLOT_LABELS, type PlanDay, type PlanItem, type Targets } from "./nutrition";

export type PlanCheck = { level: "warning" | "info"; text: string };

// How far from a target before it's worth mentioning.
const ENERGY_TOLERANCE = 0.1; // 10%
const MACRO_TOLERANCE = 0.15; // 15%
const SWAP_TOLERANCE = 0.3; // a swap within 30% of the food's energy

const fmt = (n: number) => round(n).toLocaleString("en-US");

export function planChecks(days: PlanDay[], targets: Targets | undefined, allergies: string[], firstName = "The patient"): PlanCheck[] {
  const out: PlanCheck[] = [];
  const many = days.length > 1;
  const dayName = (d: PlanDay) => (many ? d.label : "The plan");

  // Allergies first: the one check that is about safety.
  const conflicts = new Map<string, Set<string>>();
  const visit = (item: PlanItem, swap = false) => {
    for (const a of item.allergens) {
      if (!allergies.includes(a)) continue;
      const set = conflicts.get(a) ?? new Set<string>();
      set.add(swap ? `${item.name} (swap)` : item.name);
      conflicts.set(a, set);
    }
    item.alternatives?.forEach((s) => visit(s, true));
  };
  days.forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => visit(it))));
  for (const [allergen, foods] of conflicts) {
    const list = [...foods];
    out.push({
      level: "warning",
      text: `${firstName} is allergic to ${(ALLERGEN_LABELS[allergen] ?? allergen).toLowerCase()}: ${list.slice(0, 3).join(", ")}${list.length > 3 ? ` and ${list.length - 3} more` : ""}.`,
    });
  }

  for (const d of days) {
    const foods = d.meals.reduce((n, m) => n + m.items.length, 0);
    if (foods === 0) {
      out.push({ level: "warning", text: `${dayName(d)} has no food yet.` });
      continue;
    }
    for (const m of d.meals) {
      if (m.items.length === 0 && !m.notes?.trim()) out.push({ level: "info", text: `${many ? `${d.label}: ` : ""}${m.name || SLOT_LABELS[m.slot]} is empty and won't be saved.` });
    }
    const t = dayMacros(d);
    if (targets?.kcal) {
      const diff = t.kcal - targets.kcal;
      if (Math.abs(diff) > targets.kcal * ENERGY_TOLERANCE) {
        out.push({
          level: "warning",
          text: `${dayName(d)} is ${fmt(Math.abs(diff))} kcal ${diff < 0 ? "under" : "over"} the target (${fmt(t.kcal)} of ${fmt(targets.kcal)}).`,
        });
      }
    }
    // Adults are advised about 25 g of fibre a day or more.
    if (t.kcal > 800 && t.fiber_g < 20) {
      out.push({ level: "info", text: `${dayName(d)} has ${fmt(t.fiber_g)} g fibre (about 25 g a day is advised).` });
    }
    if (targets?.protein_g && t.protein_g < targets.protein_g * (1 - MACRO_TOLERANCE)) {
      out.push({ level: "warning", text: `${dayName(d)} has ${fmt(t.protein_g)} g protein, below the ${fmt(targets.protein_g)} g target.` });
    }
    for (const [key, label] of [["carbs_g", "carbs"], ["fat_g", "fat"]] as const) {
      const target = targets?.[key];
      if (target && Math.abs(t[key] - target) > target * MACRO_TOLERANCE * 1.5) {
        out.push({ level: "info", text: `${dayName(d)} has ${fmt(t[key])} g ${label} (target ${fmt(target)} g).` });
      }
    }
  }

  // Approved swaps should be roughly equivalent, or the day's totals stop meaning much.
  for (const d of days) {
    for (const m of d.meals) {
      for (const it of m.items) {
        const base = itemMacros(it).kcal;
        for (const s of it.alternatives ?? []) {
          const kcal = itemMacros(s).kcal;
          if (base > 30 && Math.abs(kcal - base) > base * SWAP_TOLERANCE) {
            out.push({ level: "info", text: `Swap "${s.name}" has ${fmt(kcal)} kcal for ${it.name}'s ${fmt(base)}. Adjust its amount?` });
          }
        }
      }
    }
  }

  if (!targets?.kcal && days.some((d) => d.meals.some((m) => m.items.length))) {
    out.push({ level: "info", text: "No energy target set, so the totals can't be checked." });
  }
  return out;
}
