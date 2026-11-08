import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { foodNames } from "@/lib/food-names";
import { amountLabel } from "@/lib/nutrition";
import { amountIn, weightIn } from "@/lib/plan-i18n";
import { patientText } from "@/lib/patient-lang";
import { activePlan } from "@/lib/patient-plan";
import { recipeDetails } from "@/lib/recipes";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ShoppingChecklist, type ShoppingGroup } from "../widgets";

export const metadata: Metadata = { title: "Shopping list" };

type Aisle = "vegetables" | "fruits" | "meat" | "dairy" | "bakery" | "legumes" | "pantry" | "drinks" | "other";
const AISLES: Aisle[] = ["vegetables", "fruits", "meat", "dairy", "bakery", "legumes", "pantry", "drinks", "other"];

// Supermarket aisle from the food's category (and "fresh" herbs with vegetables).
function aisleOf(category: string, name: string): Aisle {
  const c = category.toLowerCase();
  if (/spice|herb/.test(c)) return /fresh/i.test(name) ? "vegetables" : "pantry";
  if (/vegetable/.test(c)) return "vegetables";
  if (/fruit/.test(c)) return "fruits";
  if (/poultry|beef|pork|lamb|veal|game|fish|seafood|sausage|meat|cold cuts/.test(c)) return "meat";
  if (/dairy|egg|cheese|yog/.test(c)) return "dairy";
  if (/baked|grain|pasta|cereal|bread/.test(c)) return "bakery";
  if (/legume|nut|seed/.test(c)) return "legumes";
  if (/fat|oil|sauce|soup|sweet|snack/.test(c)) return "pantry";
  if (/beverage|drink/.test(c)) return "drinks";
  return "other";
}

const isTapWater = (name: string) => /^(beverages, )?water, tap/i.test(name);

export default async function ShoppingPage() {
  const { viewer, link } = await requirePatient();
  const { lang, t } = await patientText(viewer);
  const plan = await activePlan(link.patientId);

  if (!plan || plan.content.days.length === 0) {
    return (
      <div className="stagger space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.shopping.title}</h1>
        <Card className="rounded-2xl p-5">
          <p className="text-sm text-muted">{t.shopping.none}</p>
        </Card>
      </div>
    );
  }

  // Plans of up to 7 days repeat through the week; longer plans count once.
  const n = plan.content.days.length;
  const scale = n <= 7 ? 7 / n : 1;
  const days = n <= 7 ? 7 : n;
  const planItems = plan.content.days.flatMap((d) => d.meals.flatMap((m) => m.items));
  const recipes = await recipeDetails(planItems.map((i) => i.food_id));

  // Sum every food (recipes become their ingredients). Approved swaps are left
  // out: the patient eats one or the other.
  type Line = { food_id: string; name: string; grams: number; label: string | null | undefined; qty: number };
  const lines = new Map<string, Line>();
  const add = (food_id: string, name: string, grams: number, serving?: { label: string; qty: number } | null) => {
    const cur = lines.get(food_id) ?? { food_id, name, grams: 0, label: undefined, qty: 0 };
    cur.grams += grams;
    const label = serving?.label ?? null;
    if (cur.label === undefined) cur.label = label;
    else if (cur.label !== label) cur.label = null;
    if (label && serving) cur.qty += serving.qty;
    lines.set(food_id, cur);
  };
  for (const it of planItems) {
    const recipe = recipes.get(it.food_id);
    if (!recipe) {
      add(it.food_id, it.name, Number(it.grams) * scale, it.serving ? { label: it.serving.label, qty: Number(it.serving.qty) * scale } : null);
      continue;
    }
    const f = recipe.total > 0 ? (Number(it.grams) * scale) / recipe.total : 0;
    for (const ing of recipe.ingredients) if (!isTapWater(ing.name)) add(ing.food_id, ing.name, ing.grams * f, null);
  }

  const ids = [...lines.keys()];
  const [{ data: foods }, names] = await Promise.all([(await createClient()).from("foods").select("id, category").in("id", ids), foodNames(ids, lang)]);
  const categoryOf = new Map((foods ?? []).map((f) => [f.id, f.category]));

  const groups: ShoppingGroup[] = AISLES.map((aisle) => ({
    id: aisle,
    title: t.shopping.aisles[aisle],
    items: [...lines.values()]
      .filter((l) => aisleOf(categoryOf.get(l.food_id) ?? "", l.name) === aisle)
      .map((l) => {
        const serving = l.label ? { label: l.label, qty: Math.round(l.qty * 2) / 2 } : null;
        const amount = serving ? (lang === "en" ? amountLabel({ grams: l.grams, serving }) : amountIn({ grams: l.grams, serving }, lang)) : weightIn(l.grams, lang);
        const translated = names.get(l.food_id);
        return { key: l.food_id, name: translated ?? l.name, alt: translated ? l.name : undefined, amount };
      })
      .sort((a, b) => a.name.localeCompare(b.name, lang)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="stagger space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.shopping.title}</h1>
        <p className="text-sm text-muted">{t.shopping.forDays(days, n < 7)}</p>
      </div>
      <ShoppingChecklist planId={plan.id} groups={groups} lang={lang} />
      <p className="text-center text-xs text-muted">{t.shopping.note}</p>
    </div>
  );
}
