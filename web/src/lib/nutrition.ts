// Client-safe nutrition types and helpers shared by the builder, the patient
// file and the patient app. Saved numbers always come from the database
// (public.nx_snapshot); the client-side maths here is only a live preview
// while editing.

export type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };

export type Serving = { label: string; grams: number };

// A food as returned by search, with its servings.
export type FoodHit = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  is_recipe: boolean;
  source: "usda" | "nutrix" | "practice";
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  allergens: string[];
  servings: Serving[];
};

// One food in a meal, as edited in the builder.
export type PlanItem = {
  // Stable key while editing (not saved).
  uid?: string;
  food_id: string;
  name: string;
  grams: number;
  // How the amount is shown: 1.5 x "1 cup" (unit_g = grams in one unit).
  serving?: { label: string; qty: number; unit_g: number } | null;
  // Per 100 g, for the live preview.
  per100: Macros;
  allergens: string[];
  alternatives?: PlanItem[];
  // Units offered in the amount picker (not saved).
  units?: Serving[];
};

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type PlanMeal = { key: string; slot: MealSlot; name?: string; time?: string; notes?: string; items: PlanItem[] };
export type PlanDay = { label: string; meals: PlanMeal[] };

// Saved shapes (snapshot written by the database).
export type SavedItem = {
  food_id: string;
  name: string;
  grams: number;
  serving?: { label: string; qty: number; unit_g: number };
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  allergens?: string[];
  alternatives?: SavedItem[];
};
export type SavedMeal = { key: string; slot: MealSlot; name?: string; time?: string; notes?: string; items: SavedItem[]; totals: Macros };
export type SavedDay = { label: string; meals: SavedMeal[]; totals: Macros };
export type SavedContent = { days: SavedDay[]; totals?: Macros };

export type Targets = Partial<Pick<Macros, "kcal" | "protein_g" | "carbs_g" | "fat_g">>;

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const ALLERGENS = [
  { id: "gluten", label: "Gluten" },
  { id: "dairy", label: "Dairy" },
  { id: "egg", label: "Egg" },
  { id: "peanut", label: "Peanut" },
  { id: "tree_nut", label: "Tree nuts" },
  { id: "sesame", label: "Sesame" },
  { id: "soy", label: "Soy" },
  { id: "fish", label: "Fish" },
  { id: "shellfish", label: "Shellfish" },
] as const;

export const ALLERGEN_LABELS: Record<string, string> = Object.fromEntries(ALLERGENS.map((a) => [a.id, a.label]));

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const uid = () => Math.random().toString(36).slice(2, 10);

const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export function itemMacros(item: Pick<PlanItem, "grams" | "per100">): Macros {
  const f = item.grams / 100;
  return {
    kcal: item.per100.kcal * f,
    protein_g: item.per100.protein_g * f,
    carbs_g: item.per100.carbs_g * f,
    fat_g: item.per100.fat_g * f,
    fiber_g: item.per100.fiber_g * f,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein_g: a.protein_g + m.protein_g,
      carbs_g: a.carbs_g + m.carbs_g,
      fat_g: a.fat_g + m.fat_g,
      fiber_g: a.fiber_g + m.fiber_g,
    }),
    ZERO,
  );
}

export const mealMacros = (meal: PlanMeal) => sumMacros(meal.items.map(itemMacros));
export const dayMacros = (day: PlanDay) => sumMacros(day.meals.map(mealMacros));

export function foodToItem(food: FoodHit, grams: number, serving?: PlanItem["serving"]): PlanItem {
  return {
    uid: uid(),
    food_id: food.id,
    name: food.name,
    grams,
    serving: serving ?? null,
    per100: {
      kcal: Number(food.kcal),
      protein_g: Number(food.protein_g),
      carbs_g: Number(food.carbs_g),
      fat_g: Number(food.fat_g),
      fiber_g: Number(food.fiber_g ?? 0),
    },
    allergens: food.allergens ?? [],
    units: food.servings,
  };
}

// A newly picked food starts at one serving when it has one, else 100 g.
export function defaultItem(food: FoodHit): PlanItem {
  const s = food.servings.find((x) => x.label === "1 portion") ?? food.servings[0];
  return s ? foodToItem(food, s.grams, { label: s.label, qty: 1, unit_g: s.grams }) : foodToItem(food, 100);
}

// Saved snapshot -> editable state (per-100 g values recovered from the snapshot).
function savedItemToItem(s: SavedItem): PlanItem {
  const per = (v: number | undefined) => (s.grams > 0 ? ((v ?? 0) * 100) / s.grams : 0);
  return {
    uid: uid(),
    food_id: s.food_id,
    name: s.name,
    grams: Number(s.grams),
    serving: s.serving ?? null,
    per100: { kcal: per(s.kcal), protein_g: per(s.protein_g), carbs_g: per(s.carbs_g), fat_g: per(s.fat_g), fiber_g: per(s.fiber_g) },
    allergens: s.allergens ?? [],
    alternatives: (s.alternatives ?? []).map(savedItemToItem),
    units: s.serving ? [{ label: s.serving.label, grams: s.serving.unit_g }] : [],
  };
}

export function contentToDays(content: SavedContent | null | undefined): PlanDay[] {
  return (content?.days ?? []).map((d) => ({
    label: d.label,
    meals: d.meals.map((m) => ({ key: m.key, slot: m.slot, name: m.name, time: m.time, notes: m.notes, items: m.items.map(savedItemToItem) })),
  }));
}

// Editable state -> what the database snapshots (food ids, grams, serving).
export function daysToContent(days: PlanDay[]) {
  const item = (i: PlanItem): Record<string, unknown> => ({
    food_id: i.food_id,
    name: i.name,
    grams: Math.round(i.grams * 10) / 10,
    serving: i.serving ?? undefined,
    alternatives: i.alternatives?.length ? i.alternatives.map(item) : undefined,
  });
  return {
    days: days.map((d) => ({
      label: d.label,
      meals: d.meals.map((m) => ({ key: m.key, slot: m.slot, name: m.name, time: m.time, notes: m.notes, items: m.items.map(item) })),
    })),
  };
}

// Share of energy from each macro (4/4/9 kcal per gram).
export function energySplit(m: Pick<Macros, "protein_g" | "carbs_g" | "fat_g">) {
  const p = m.protein_g * 4;
  const c = m.carbs_g * 4;
  const f = m.fat_g * 9;
  const total = p + c + f;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: (p / total) * 100, carbs: (c / total) * 100, fat: (f / total) * 100 };
}

// Which day of the plan applies on `date`: weekday names map to weekdays,
// otherwise the days repeat from the plan's start.
export function dayIndexFor(content: SavedContent, startsOn: string | null, date: string) {
  const n = content.days.length;
  if (n <= 1) return 0;
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  if (n === 7 && content.days.every((d, i) => d.label === WEEKDAYS[i])) return weekday;
  const from = startsOn ?? date;
  const diff = Math.max(0, Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
  return diff % n;
}

export const round = (v: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

// "150 g" or "1.5 cup (240 g)".
export function amountLabel(item: { grams: number; serving?: { label: string; qty: number } | null }) {
  if (item.serving && item.serving.qty > 0) {
    const label = item.serving.label.replace(/^1\s+/, "");
    return `${round(item.serving.qty, 2)} x ${label} (${round(item.grams)} g)`;
  }
  return `${round(item.grams)} g`;
}
