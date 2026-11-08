import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ExternalLink, Plus, Search } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { MacroSummary } from "@/components/macro-summary";
import { PageTabs, TabPanel } from "@/components/page-tabs";
import { RouteModal } from "@/components/route-modal";
import { RowMenu } from "@/components/row-menu";
import { Badge, buttonClass, Card, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { allergenNote, sourceLink, sourceNote } from "@/lib/food-sources";
import { ALLERGEN_LABELS, round } from "@/lib/nutrition";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { archiveFood, copyRecipe, saveFood } from "./actions";
import { FoodForm, RecipeEditor } from "./forms";

export const metadata: Metadata = { title: "Foods & recipes" };

const TABS = ["library", "mine"] as const;

export default async function FoodsPage({ searchParams }: PageProps<"/dashboard/foods">) {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const supabase = await createClient();

  const [{ data: results }, { data: mine }, { data: datasets }] = await Promise.all([
    supabase.rpc("search_foods", { p_query: query, p_limit: 60 }),
    supabase.from("foods").select("*").eq("practice_id", membership.practiceId).is("archived_at", null).order("is_recipe", { ascending: false }).order("name"),
    supabase.from("food_datasets").select("id, name, attribution, licence, food_count").gt("food_count", 0).order("food_count", { ascending: false }),
  ]);
  const libraryCount = (datasets ?? []).reduce((n, d) => n + d.food_count, 0);
  const attributions = [...new Set((datasets ?? []).filter((d) => d.id !== "nutrix").map((d) => `${d.attribution} (${d.licence})`))];

  const foodParam = typeof sp.food === "string" ? sp.food : null;
  const recipeParam = typeof sp.recipe === "string" ? sp.recipe : null;
  const tab = TABS.includes(sp.tab as (typeof TABS)[number]) ? (sp.tab as string) : "library";
  const keep = new URLSearchParams({ ...(query ? { q: query } : {}), tab });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foods & recipes"
        description="Generic foods, packaged products, Lebanese dishes, and your practice's own foods and recipes."
        action={
          <div className="flex flex-wrap gap-2">
            <Dialog label="New food" variant="secondary" icon={<Plus className="size-4" />} title="New food" description="A packaged or local product, with values from its label." size="lg">
              <FoodForm action={saveFood.bind(null, null)} />
            </Dialog>
            <Link href={`/dashboard/foods?tab=mine&recipe=new`} scroll={false} className={buttonClass("primary")}>
              <Plus className="size-4" /> New recipe
            </Link>
          </div>
        }
      />

      <PageTabs
        instant
        base={`/dashboard/foods${query ? `?q=${encodeURIComponent(query)}` : ""}`}
        active={tab}
        tabs={[
          { id: "library", label: "Library" },
          { id: "mine", label: "My foods & recipes", count: mine?.length },
        ]}
      />

      <TabPanel id="library" tabs={TABS}>
        <form role="search" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={query} placeholder={`Search ${libraryCount > 1000 ? `${(Math.floor(libraryCount / 1000) * 1000).toLocaleString("en-US")}+ ` : ""}foods by name, brand or barcode, e.g. kibbeh, chicken breast, labneh`} className={`${inputClass} pl-10`} />
        </form>
        <Card className="mt-4">
          {!results?.length ? (
            <EmptyState>
              <span className="block pt-5">No food matches &quot;{query}&quot;. Try fewer words, or add it as a new food.</span>
            </EmptyState>
          ) : (
            <FoodList foods={results} hrefFor={(id) => `/dashboard/foods?${keep}&food=${id}`} />
          )}
        </Card>
        <p className="mt-3 text-xs text-muted">
          {query ? `Top ${results?.length ?? 0} matches: generic foods first, then packaged products.` : "Your foods and the Lebanese dishes first. Search to see everything."}
          {attributions.length > 0 && ` Library data: ${attributions.join("; ")}.`}
        </p>
      </TabPanel>

      <TabPanel id="mine" tabs={TABS}>
        <Card>
          {!mine?.length ? (
            <EmptyState>
              <span className="block pt-5">Nothing yet. Add a local product from its label, build a recipe, or copy a Lebanese dish to adjust it.</span>
            </EmptyState>
          ) : (
            <FoodList
              foods={mine}
              hrefFor={(id) => `/dashboard/foods?${keep}&food=${id}`}
              menu={(f) => (
                <RowMenu
                  items={[
                    f.is_recipe
                      ? { kind: "link", label: "Edit recipe", href: `/dashboard/foods?tab=mine&recipe=${f.id}` }
                      : { kind: "link", label: "View", href: `/dashboard/foods?tab=mine&food=${f.id}` },
                    f.is_recipe && { kind: "action", label: "Duplicate", action: copyRecipe.bind(null, f.id) },
                    { kind: "action", label: "Remove", danger: true, action: archiveFood.bind(null, f.id), confirm: `Remove "${f.name}"? Plans that already use it keep their numbers.` },
                  ]}
                />
              )}
            />
          )}
        </Card>
      </TabPanel>

      {foodParam && <FoodDetail id={foodParam} practiceId={membership.practiceId} />}
      {recipeParam && <RecipeModal id={recipeParam === "new" ? null : recipeParam} practiceId={membership.practiceId} />}
    </div>
  );
}

function FoodList({ foods, hrefFor, menu }: { foods: Tables<"foods">[]; hrefFor: (id: string) => string; menu?: (f: Tables<"foods">) => React.ReactNode }) {
  return (
    <ul className="divide-y divide-line">
      {foods.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-5 py-3">
          <Link href={hrefFor(f.id)} scroll={false} className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {f.is_recipe && <BookOpen className="size-4 shrink-0 text-brand-strong" aria-label="Recipe" />}
              <span className="line-clamp-1 font-medium hover:underline">{f.name}</span>
            </span>
            <span className="block truncate text-sm text-muted">
              {f.practice_id ? "Your practice" : f.category}
              {f.brand ? ` · ${f.brand}` : ""}
            </span>
          </Link>
          <span className="shrink-0 text-right text-sm tabular-nums">
            <span className="block font-medium">{round(Number(f.kcal))} kcal</span>
            <span className="block text-xs text-muted">
              P {round(Number(f.protein_g), 1)} · C {round(Number(f.carbs_g), 1)} · F {round(Number(f.fat_g), 1)}
            </span>
          </span>
          {menu?.(f)}
        </li>
      ))}
    </ul>
  );
}

async function FoodDetail({ id, practiceId }: { id: string; practiceId: string }) {
  const supabase = await createClient();
  const [{ data: food }, { data: servings }, { data: ingredients }] = await Promise.all([
    supabase.from("foods").select("*").eq("id", id).maybeSingle(),
    supabase.from("food_servings").select("label, grams").eq("food_id", id).order("sort"),
    supabase.from("recipe_ingredients").select("grams, note, sort, foods!recipe_ingredients_food_id_fkey(name, kcal)").eq("recipe_id", id).order("sort"),
  ]);
  if (!food) return null;
  const per100 = { kcal: Number(food.kcal), protein_g: Number(food.protein_g), carbs_g: Number(food.carbs_g), fat_g: Number(food.fat_g), fiber_g: Number(food.fiber_g ?? 0) };
  const own = food.practice_id === practiceId;
  const link = sourceLink(food);

  return (
    <RouteModal param="food" size="lg" title={food.name} description={food.practice_id ? "Your practice" : food.category}>
      <div className="space-y-5">
        <div className="rounded-xl bg-canvas p-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Per 100 g</p>
          <MacroSummary totals={per100} />
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {(
              [
                ["Fibre", food.fiber_g, "g"],
                ["Sugars", food.sugar_g, "g"],
                ["Sodium", food.sodium_mg, "mg"],
              ] as const
            ).map(([l, v, u]) => (
              <div key={l}>
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="tabular-nums">{v === null ? "-" : `${round(Number(v), 1)} ${u}`}</dd>
              </div>
            ))}
          </dl>
        </div>

        {food.allergens.length > 0 && (
          <p className="text-sm">
            <span className="font-medium">Contains:</span> {food.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}
            {allergenNote(food) && <span className="block text-xs text-muted">{allergenNote(food)}</span>}
          </p>
        )}

        {servings && servings.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Servings</p>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {servings.map((s) => (
                <li key={s.label} className="flex justify-between gap-3 px-4 py-2.5 tabular-nums">
                  <span>
                    {s.label} <span className="text-muted">({round(Number(s.grams))} g)</span>
                  </span>
                  <span className="text-muted">{round((per100.kcal * Number(s.grams)) / 100)} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {food.is_recipe && ingredients && (
          <div>
            <p className="mb-2 text-sm font-medium">Ingredients{food.recipe_servings ? ` (makes ${food.recipe_servings} portions)` : ""}</p>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {ingredients.map((i) => (
                <li key={i.sort} className="flex justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="line-clamp-1">{i.foods?.name}</span>
                    {i.note && <span className="block text-xs text-muted">{i.note}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{round(Number(i.grams))} g</span>
                </li>
              ))}
            </ul>
            {food.instructions && <p className="mt-3 text-sm whitespace-pre-line text-muted">{food.instructions}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">
            {link ? (
              <>
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                  {link.label} <ExternalLink className="size-3" />
                </a>
                {sourceNote(food) && <span className="block">{sourceNote(food)}</span>}
                {food.barcode && <span className="block">Barcode {food.barcode}</span>}
              </>
            ) : sourceNote(food) ? (
              sourceNote(food)
            ) : food.source === "nutrix" ? (
              "Nutrix standard recipe, computed from USDA ingredients. Copy it to adjust to your patients."
            ) : food.is_recipe ? (
              "Your recipe, computed from its ingredients."
            ) : (
              "Your food, from its label."
            )}
          </p>
          {food.is_recipe && !own && (
            <form action={async () => {
              "use server";
              await copyRecipe(food.id);
            }}>
              <button className={buttonClass("primary")}>Copy to my recipes</button>
            </form>
          )}
          {own && food.is_recipe && (
            <Link href={`/dashboard/foods?tab=mine&recipe=${food.id}`} scroll={false} className={buttonClass("secondary")}>
              Edit recipe
            </Link>
          )}
          {own && !food.is_recipe && (
            <Dialog label="Edit" variant="secondary" title="Edit food" size="lg">
              <FoodForm
                action={saveFood.bind(null, food.id)}
                food={{
                  ...food,
                  kcal: Number(food.kcal),
                  protein_g: Number(food.protein_g),
                  carbs_g: Number(food.carbs_g),
                  fat_g: Number(food.fat_g),
                  fiber_g: food.fiber_g === null ? null : Number(food.fiber_g),
                  sugar_g: food.sugar_g === null ? null : Number(food.sugar_g),
                  sodium_mg: food.sodium_mg === null ? null : Number(food.sodium_mg),
                  servings: (servings ?? []).map((s) => ({ label: s.label, grams: Number(s.grams) })),
                }}
              />
            </Dialog>
          )}
        </div>
        {food.is_recipe && <Badge tone="gray">Recipe</Badge>}
      </div>
    </RouteModal>
  );
}

async function RecipeModal({ id, practiceId }: { id: string | null; practiceId: string }) {
  const supabase = await createClient();
  let initial = { name: "", category: "", servings: 4 as number | null, yieldG: null as number | null, instructions: "", ingredients: [] as Parameters<typeof RecipeEditor>[0]["initial"]["ingredients"] };
  if (id) {
    const [{ data: recipe }, { data: rows }] = await Promise.all([
      supabase.from("foods").select("*").eq("id", id).eq("practice_id", practiceId).eq("is_recipe", true).maybeSingle(),
      supabase.from("recipe_ingredients").select("grams, note, sort, food:foods!recipe_ingredients_food_id_fkey(*)").eq("recipe_id", id).order("sort"),
    ]);
    if (!recipe) return null;
    initial = {
      name: recipe.name,
      category: recipe.category,
      servings: recipe.recipe_servings,
      yieldG: recipe.recipe_yield_g === null ? null : Number(recipe.recipe_yield_g),
      instructions: recipe.instructions ?? "",
      ingredients: (rows ?? []).flatMap((r) =>
        r.food
          ? [
              {
                uid: `${r.sort}`,
                food_id: r.food.id,
                name: r.food.name,
                grams: Number(r.grams),
                note: r.note ?? undefined,
                allergens: r.food.allergens,
                per100: { kcal: Number(r.food.kcal), protein_g: Number(r.food.protein_g), carbs_g: Number(r.food.carbs_g), fat_g: Number(r.food.fat_g), fiber_g: Number(r.food.fiber_g ?? 0) },
              },
            ]
          : [],
      ),
    };
  }
  return (
    <RouteModal param="recipe" size="xl" title={id ? `Edit ${initial.name}` : "New recipe"} description="Build it from ingredients; the nutrition is computed for you.">
      <RecipeEditor recipeId={id} initial={initial} closeParams={["recipe"]} />
    </RouteModal>
  );
}
