// Where a library food's numbers come from, with the link and attribution its
// licence asks for. Datasets and their licences live in public.food_datasets.

type SourceFood = { source: string; source_ref: string | null; dataset?: string | null; branded?: boolean };

export function sourceLink(food: SourceFood): { label: string; href: string } | null {
  if (!food.source_ref) return null;
  if (food.source === "usda") {
    return { label: `USDA FoodData Central #${food.source_ref}`, href: `https://fdc.nal.usda.gov/food-details/${food.source_ref}/nutrients` };
  }
  if (food.source === "openfoodfacts") {
    return { label: `Open Food Facts ${food.source_ref} (ODbL)`, href: `https://world.openfoodfacts.org/product/${encodeURIComponent(food.source_ref)}` };
  }
  return null;
}

export function sourceNote(food: SourceFood): string | null {
  if (food.source === "cnf") return "Canadian Nutrient File, Health Canada, 2015. Open Government Licence - Canada.";
  if (food.source === "openfoodfacts") return "Crowd-sourced label data. Check the package when exact values matter.";
  if (food.dataset === "usda_branded") return "Label data supplied by the manufacturer to USDA.";
  return null;
}

// How allergen tags were found, shown under "Contains".
export function allergenNote(food: SourceFood): string | null {
  if (food.source === "openfoodfacts") return "From the product's listed allergens. Check the label.";
  if (food.dataset === "usda_branded") return "Matched from the ingredient list. Check the label.";
  if (food.source === "usda" || food.source === "cnf") return "Matched from the food's name. Check labels for packaged products.";
  return null;
}
