// Suggested daily targets from a patient's own numbers: a starting point the
// dietitian adjusts, never a prescription. Client-safe.
//
// Energy: Mifflin-St Jeor resting energy x an activity factor, then a goal
// adjustment, never below a floor. Protein by body weight, fat 30% of energy,
// carbs the rest.

import type { Targets } from "./nutrition";

export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "lose_slow" | "maintain" | "gain";

export type TargetProfile = {
  firstName: string;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: "female" | "male" | null;
  activity: Activity | null;
  goalText: string | null;
};

export const ACTIVITY_FACTOR: Record<Activity, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };

export const GOALS: { id: Goal; label: string; kcal: number; proteinPerKg: number }[] = [
  { id: "lose", label: "Lose weight", kcal: -500, proteinPerKg: 1.6 },
  { id: "lose_slow", label: "Lose slowly", kcal: -250, proteinPerKg: 1.4 },
  { id: "maintain", label: "Maintain", kcal: 0, proteinPerKg: 1.2 },
  { id: "gain", label: "Gain", kcal: 300, proteinPerKg: 1.6 },
];

// The goal written in the health file, if it says something recognisable.
export function guessGoal(text: string | null | undefined): Goal {
  const t = (text ?? "").toLowerCase();
  if (/\b(gain|bulk|muscle|build)\b/.test(t)) return "gain";
  if (/\b(lose|loss|losing|slim|reduce|weight down|fat loss|overweight|obes)/.test(t)) return "lose";
  return "maintain";
}

export function missingForTargets(p: TargetProfile): string[] {
  return [
    !p.weightKg && "weight",
    !p.heightCm && "height",
    p.age === null && "age",
    !p.sex && "sex",
  ].filter((x): x is string => Boolean(x));
}

export type Suggestion = { targets: Required<Targets>; restingKcal: number; maintenanceKcal: number; explanation: string };

export function suggestTargets(p: TargetProfile, goal: Goal): Suggestion | null {
  if (missingForTargets(p).length) return null;
  const w = p.weightKg!, h = p.heightCm!, a = p.age!;
  const resting = 10 * w + 6.25 * h - 5 * a + (p.sex === "male" ? 5 : -161);
  const activity = p.activity ?? "light";
  const maintenance = resting * ACTIVITY_FACTOR[activity];
  const g = GOALS.find((x) => x.id === goal)!;
  // Never below resting energy, nor below a common minimum for unsupervised plans.
  const floor = Math.max(resting, p.sex === "male" ? 1500 : 1200);
  const kcal = Math.round(Math.max(maintenance + g.kcal, goal === "maintain" || goal === "gain" ? 0 : floor) / 10) * 10;

  // Protein by weight, kept between 15% and 35% of energy.
  const protein = Math.min(Math.max(g.proteinPerKg * w, (kcal * 0.15) / 4), (kcal * 0.35) / 4);
  const fat = (kcal * 0.3) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  const activityLabel = { sedentary: "sedentary", light: "lightly active", moderate: "moderately active", active: "active", very_active: "very active" }[activity];

  return {
    targets: { kcal, protein_g: Math.round(protein), carbs_g: Math.round(carbs), fat_g: Math.round(fat) },
    restingKcal: Math.round(resting),
    maintenanceKcal: Math.round(maintenance),
    explanation:
      `Resting energy ${Math.round(resting).toLocaleString("en-US")} kcal (Mifflin-St Jeor), ` +
      `x ${ACTIVITY_FACTOR[activity]} for ${activityLabel}${p.activity ? "" : " (activity not recorded, assumed)"} = ` +
      `${Math.round(maintenance).toLocaleString("en-US")} kcal to maintain` +
      (g.kcal ? `, ${g.kcal > 0 ? "+" : ""}${g.kcal} kcal to ${g.label.toLowerCase()}` : "") +
      (kcal > maintenance + g.kcal + 5 ? `, raised to the ${floor.toLocaleString("en-US")} kcal minimum` : "") +
      `. Protein ${g.proteinPerKg} g/kg, fat 30%, carbs the rest.`,
  };
}
