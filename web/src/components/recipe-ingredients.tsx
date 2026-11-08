import { ChefHat } from "lucide-react";
import { weightIn } from "@/lib/plan-i18n";
import type { Lang } from "@/lib/patient-i18n";
import type { RecipeIngredient } from "@/lib/recipes";

// The ingredients behind a recipe the patient eats, for the exact amount, so
// they can cook the same dish. Names are already in the patient's language.
export function RecipeIngredients({ title, ingredients, lang }: { title: string; ingredients: RecipeIngredient[]; lang: Lang }) {
  if (!ingredients.length) return null;
  return (
    <details className="group mt-1.5 rounded-lg bg-canvas px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-ink/80">
        <ChefHat className="size-3.5 shrink-0" />
        {title}
      </summary>
      <ul className="mt-2 space-y-1">
        {ingredients.map((i, n) => (
          <li key={`${i.food_id}-${n}`} className="flex justify-between gap-3">
            <span className="min-w-0">
              <bdi>{i.name}</bdi>
              {i.note && <span className="text-muted"> · {i.note}</span>}
            </span>
            <span className="shrink-0 text-muted tabular-nums">{weightIn(i.grams, lang)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
