"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useDialogAction } from "@/components/dialog";
import { FoodSearch } from "@/components/food-search";
import { MacroSummary } from "@/components/macro-summary";
import { showToast } from "@/components/toaster";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { ALLERGEN_LABELS, ALLERGENS, foodToItem, itemMacros, round, sumMacros, type FoodHit, type PlanItem } from "@/lib/nutrition";
import { saveRecipe, type RecipeInput } from "./actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type FoodValues = {
  name: string;
  brand: string | null;
  category: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  allergens: string[];
  servings: { label: string; grams: number }[];
};

const NUTRIENT_FIELDS = [
  { name: "kcal", label: "Energy", unit: "kcal", required: true },
  { name: "protein_g", label: "Protein", unit: "g", required: true },
  { name: "carbs_g", label: "Carbohydrates", unit: "g", required: true },
  { name: "fat_g", label: "Fat", unit: "g", required: true },
  { name: "fiber_g", label: "Fibre", unit: "g", required: false },
  { name: "sugar_g", label: "Sugars", unit: "g", required: false },
  { name: "sodium_mg", label: "Sodium", unit: "mg", required: false },
] as const;

export function FoodForm({ action, food }: { action: Action; food?: FoodValues }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [servings, setServings] = useState(food?.servings.length ? food.servings : [{ label: "", grams: 0 }]);
  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required maxLength={200} defaultValue={food?.name} placeholder="e.g. Labneh, full fat" className={inputClass} />
        </Field>
        <Field label="Brand" optional>
          <input name="brand" maxLength={120} defaultValue={food?.brand ?? ""} className={inputClass} />
        </Field>
        <Field label="Category" optional>
          <input name="category" maxLength={80} defaultValue={food?.category ?? ""} placeholder="e.g. Dairy & eggs" className={inputClass} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Nutrition per 100 g</p>
        <p className="mb-3 text-xs text-muted">Copy these from the product label or a lab analysis.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUTRIENT_FIELDS.map((n) => (
            <label key={n.name} className="block space-y-1">
              <span className="text-xs text-muted">
                {n.label}
                {!n.required && " (optional)"}
              </span>
              <span className="relative block">
                <input
                  name={n.name}
                  inputMode="decimal"
                  required={n.required}
                  defaultValue={food ? (food[n.name] ?? "") : ""}
                  className={`${inputClass} pr-12`}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{n.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Contains</legend>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <label key={a.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-canvas">
              <input type="checkbox" name="allergens" value={a.id} defaultChecked={food?.allergens.includes(a.id)} className="accent-ink" />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-medium">Servings</p>
        <div className="space-y-2">
          {servings.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="serving_label"
                value={s.label}
                onChange={(e) => setServings(servings.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                placeholder="e.g. 1 tablespoon"
                maxLength={120}
                aria-label="Serving name"
                className={`${inputClass} flex-1`}
              />
              <span className="relative w-28">
                <input
                  name="serving_grams"
                  inputMode="decimal"
                  value={s.grams || ""}
                  onChange={(e) => setServings(servings.map((x, j) => (j === i ? { ...x, grams: Number(e.target.value.replace(",", ".")) || 0 } : x)))}
                  aria-label="Grams"
                  className={`${inputClass} pr-8`}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">g</span>
              </span>
              <button type="button" onClick={() => setServings(servings.filter((_, j) => j !== i))} aria-label="Remove serving" className="grid size-11 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-danger">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setServings([...servings, { label: "", grams: 0 }])} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-ink">
            <Plus className="size-4" /> Add serving
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : food ? "Save" : "Add food"}
        </Button>
      </div>
    </form>
  );
}

type Ingredient = PlanItem & { note?: string };

export function RecipeEditor({
  recipeId,
  initial,
  closeParams,
}: {
  recipeId: string | null;
  initial: { name: string; category: string; servings: number | null; yieldG: number | null; instructions: string; ingredients: Ingredient[] };
  closeParams: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = sumMacros(form.ingredients.map(itemMacros));
  const rawWeight = form.ingredients.reduce((a, i) => a + i.grams, 0);
  const weight = form.yieldG && form.yieldG > 0 ? form.yieldG : rawWeight;
  const per = (d: number) => ({ kcal: total.kcal / d, protein_g: total.protein_g / d, carbs_g: total.carbs_g / d, fat_g: total.fat_g / d, fiber_g: total.fiber_g / d });
  const allergens = [...new Set(form.ingredients.flatMap((i) => i.allergens))];

  function setIngredient(i: number, patch: Partial<Ingredient>) {
    setForm({ ...form, ingredients: form.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  }

  function save() {
    setError(null);
    const input: RecipeInput = {
      name: form.name,
      category: form.category,
      servings: form.servings,
      yieldG: form.yieldG,
      instructions: form.instructions,
      ingredients: form.ingredients.map((i) => ({ food_id: i.food_id, grams: round(i.grams, 1), note: i.note })),
    };
    startTransition(async () => {
      const result = await saveRecipe(recipeId, input);
      if (result.error) return setError(result.error);
      showToast(result.success ?? "Saved");
      const next = new URLSearchParams(searchParams.toString());
      for (const p of closeParams) next.delete(p);
      router.replace(`${pathname}?${next}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recipe name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} className={inputClass} />
        </Field>
        <Field label="Category" optional>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={80} placeholder="Recipes" className={inputClass} />
        </Field>
        <Field label="Portions it makes" optional>
          <input
            inputMode="numeric"
            value={form.servings ?? ""}
            onChange={(e) => setForm({ ...form, servings: Number(e.target.value.replace(/\D/g, "")) || null })}
            className={inputClass}
          />
        </Field>
        <Field label="Cooked weight" optional hint={`Leave empty to use the raw total (${round(rawWeight)} g).`}>
          <div className="relative">
            <input
              inputMode="decimal"
              value={form.yieldG ?? ""}
              onChange={(e) => setForm({ ...form, yieldG: Number(e.target.value.replace(",", ".")) || null })}
              className={`${inputClass} pr-10`}
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted">g</span>
          </div>
        </Field>
      </div>

      <div className="rounded-xl border border-line">
        <p className="border-b border-line px-4 py-3 text-sm font-semibold">Ingredients</p>
        <ul className="divide-y divide-line">
          {form.ingredients.map((ing, i) => (
            <li key={ing.uid ?? i} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 basis-56">
                <span className="block text-sm font-medium">{ing.name}</span>
                <input
                  value={ing.note ?? ""}
                  onChange={(e) => setIngredient(i, { note: e.target.value })}
                  placeholder="Note, e.g. finely chopped"
                  maxLength={120}
                  aria-label="Ingredient note"
                  className="mt-0.5 w-full rounded bg-transparent text-xs text-muted outline-none placeholder:text-muted/60 focus:bg-canvas"
                />
              </span>
              <span className="relative w-28">
                <input
                  inputMode="decimal"
                  defaultValue={round(ing.grams, 1)}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (n > 0) setIngredient(i, { grams: n });
                  }}
                  aria-label={`Grams of ${ing.name}`}
                  className="h-9 w-full rounded-lg border border-line bg-surface pr-7 pl-2 text-right text-sm tabular-nums outline-none focus:border-ink"
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">g</span>
              </span>
              <span className="w-20 text-right text-xs text-muted tabular-nums">{round(itemMacros(ing).kcal)} kcal</span>
              <button
                type="button"
                onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, j) => j !== i) })}
                aria-label={`Remove ${ing.name}`}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="p-4">
          <FoodSearch
            placeholder="Add an ingredient"
            onPick={(f: FoodHit) => setForm({ ...form, ingredients: [...form.ingredients, foodToItem(f, f.servings[0]?.grams ?? 100)] })}
          />
        </div>
      </div>

      {form.ingredients.length > 0 && (
        <div className="grid gap-4 rounded-xl bg-canvas p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{form.servings ? "Per portion" : "Whole recipe"}</p>
            <MacroSummary compact totals={form.servings ? per(form.servings) : total} />
            {form.servings ? <p className="mt-2 text-xs text-muted">1 portion = {round(weight / form.servings)} g</p> : null}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Per 100 g</p>
            <MacroSummary compact totals={per(weight / 100 || 1)} />
            {allergens.length > 0 && <p className="mt-2 text-xs text-danger">Contains: {allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}</p>}
          </div>
        </div>
      )}

      <Field label="Method" optional>
        <textarea
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          rows={4}
          maxLength={5000}
          className={`${inputClass} h-auto py-2.5`}
        />
      </Field>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Nutrition is computed from the ingredients when you save.</p>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save recipe"}
        </Button>
      </div>
    </div>
  );
}
