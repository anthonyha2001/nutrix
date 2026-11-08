// USDA FoodData Central: Foundation, FNDDS (Survey) and Branded Foods.
// Nutrient amounts in FDC are per 100 g for all three. CC0.
import { openZip, rows, has } from "../zipcsv.mjs";
import { allergensFromText, barcode, categorize, clean, tidyBrand, tidyName } from "../normalize.mjs";

// Column order of a value slot -> FDC nutrient ids in order of preference.
// The FNDDS (Survey) file keys nutrients by nutrient number (208) instead of id
// (1008); numbers are below 1000 and ids above, so both are listed.
const NUTRIENTS = {
  kcal: [1008, 208, 2048, 958, 2047, 957],
  protein_g: [1003, 203],
  fat_g: [1004, 204, 1085, 298],
  carbs_g: [1005, 205, 1050],
  fiber_g: [1079, 291],
  sugar_g: [2000, 269, 1063],
  sodium_mg: [1093, 307],
};
const SLOT = Object.keys(NUTRIENTS);
const WANTED = new Map(); // nutrient id -> [slot index, rank]
SLOT.forEach((slot, i) => NUTRIENTS[slot].forEach((id, rank) => WANTED.set(String(id), [i, rank])));

// USDA Branded categories the keyword rules get wrong. null = decide from the product name.
const BRANDED_CATEGORY = {
  "Cereal": "Breakfast cereals",
  "Processed Cereal Products": "Breakfast cereals",
  "Snack, Energy & Granola Bars": "Snacks",
  "Ketchup, Mustard, BBQ & Cheese Sauce": "Soups & sauces",
  "Frozen Appetizers & Hors D'oeuvres": "Prepared meals",
  "Other Deli": "Prepared meals",
  "Frozen Prepared Sides": "Prepared meals",
  "Stuffing": "Prepared meals",
  "Crusts & Dough": "Baked goods",
  "Baking/Cooking Mixes/Supplies": "Baked goods",
  "Baking Additives & Extracts": "Baked goods",
  "Alcohol": "Beverages",
  "Other Grains & Seeds": "Grains & pasta",
  "Frozen Fruit & Fruit Juice Concentrates": "Fruits",
  "Other Meats": null,
  "Canned Meat": null,
  "Cooked & Prepared": null,
  "Frozen Patties and Burgers": null,
};

function brandedCategory(category, name) {
  if (category && /^Meat\/Poultry\/Other Animals/i.test(category)) return categorize(name, "meat");
  if (category in BRANDED_CATEGORY) {
    return BRANDED_CATEGORY[category] ?? (categorize(name) === "Other" ? "Prepared meals" : categorize(name));
  }
  return categorize(category, name);
}

// USDA Branded descriptions often end with the flavour repeated:
// "Peach flavored yogurt smoothie, peach" -> "Peach flavored yogurt smoothie".
function dropRepeatedSuffix(name) {
  const i = name.lastIndexOf(", ");
  if (i <= 0) return name;
  const head = name.slice(0, i), tail = name.slice(i + 2).trim().toLowerCase();
  return tail && head.toLowerCase().includes(tail) ? head : name;
}

const DATA_TYPE = { usda_foundation: "foundation_food", usda_survey: "survey_fndds_food", usda_branded: "branded_food" };

async function readNutrients(z, ids) {
  // values[i*2] = amount, values[i*2+1] = rank of the nutrient id it came from
  const byFood = new Map();
  for await (const r of rows(z, "food_nutrient.csv")) {
    const w = WANTED.get(r.nutrient_id);
    if (!w || !ids.has(r.fdc_id)) continue;
    const amount = Number(r.amount);
    if (!Number.isFinite(amount)) continue;
    let v = byFood.get(r.fdc_id);
    if (!v) byFood.set(r.fdc_id, (v = new Float32Array(SLOT.length * 2).fill(NaN)));
    const [slot, rank] = w;
    if (Number.isNaN(v[slot * 2]) || rank < v[slot * 2 + 1]) {
      v[slot * 2] = amount;
      v[slot * 2 + 1] = rank;
    }
  }
  return byFood;
}

function values(v) {
  const out = {};
  SLOT.forEach((slot, i) => (out[slot] = v && !Number.isNaN(v[i * 2]) ? v[i * 2] : null));
  return out;
}

async function readPortions(z) {
  const units = new Map();
  if (has(z, "measure_unit.csv")) for await (const r of rows(z, "measure_unit.csv")) units.set(r.id, r.name);
  const portions = new Map();
  if (!has(z, "food_portion.csv")) return portions;
  for await (const r of rows(z, "food_portion.csv")) {
    const grams = Number(r.gram_weight);
    if (!(grams > 0)) continue;
    let label = (r.portion_description || "").trim();
    if (!label || /quantity not specified/i.test(label)) {
      const unit = units.get(r.measure_unit_id);
      const parts = [r.amount && Number(r.amount) ? Number(r.amount) : "", unit && unit !== "undetermined" ? unit : "", r.modifier || ""];
      label = parts.join(" ").replace(/\s+/g, " ").trim();
      if (!label && /quantity not specified/i.test(r.portion_description || "")) label = "Average portion";
    }
    if (!label) continue;
    const list = portions.get(r.fdc_id) ?? [];
    list.push({ label, grams, seq: Number(r.seq_num) || list.length });
    portions.set(r.fdc_id, list);
  }
  for (const list of portions.values()) list.sort((a, b) => a.seq - b.seq);
  return portions;
}

export async function build(dataset, zipPath, emit, log) {
  const z = await openZip(zipPath);
  const dataType = DATA_TYPE[dataset];

  // Categories
  const categories = new Map();
  if (has(z, "food_category.csv")) for await (const r of rows(z, "food_category.csv")) categories.set(r.id, r.description);
  const wweia = new Map();
  if (has(z, "wweia_food_category.csv")) {
    for await (const r of rows(z, "wweia_food_category.csv")) wweia.set(r.wweia_food_category, r.wweia_food_category_description);
  }
  const surveyCat = new Map();
  if (dataset === "usda_survey" && has(z, "survey_fndds_food.csv")) {
    for await (const r of rows(z, "survey_fndds_food.csv")) surveyCat.set(r.fdc_id, wweia.get(r.wweia_category_number ?? r.wweia_category_code));
  }

  // Branded: one row per GTIN, the most recently published one; skip discontinued.
  const branded = new Map();
  if (dataset === "usda_branded") {
    const byGtin = new Map();
    for await (const r of rows(z, "branded_food.csv")) {
      if (r.discontinued_date) continue;
      const code = barcode(r.gtin_upc);
      const key = code ? code.replace(/^0+/, "") : `fdc${r.fdc_id}`;
      const date = r.available_date || r.modified_date || "";
      const prev = byGtin.get(key);
      if (prev && prev.date >= date) continue;
      byGtin.set(key, { fdc: r.fdc_id, date });
      branded.set(r.fdc_id, {
        brand: tidyBrand(r.brand_name || r.brand_owner),
        barcode: code,
        ingredients: r.ingredients,
        category: r.branded_food_category,
        servingSize: Number(r.serving_size),
        servingUnit: (r.serving_size_unit || "").toLowerCase(),
        household: (r.household_serving_fulltext || "").trim(),
      });
    }
    const keep = new Set([...byGtin.values()].map((v) => v.fdc));
    for (const id of branded.keys()) if (!keep.has(id)) branded.delete(id);
    log(`branded products after de-duplicating by barcode: ${branded.size}`);
  }

  // Foods of this data type
  const foods = new Map();
  for await (const r of rows(z, "food.csv")) {
    if (r.data_type !== dataType) continue;
    if (dataset === "usda_branded" && !branded.has(r.fdc_id)) continue;
    foods.set(r.fdc_id, { description: r.description, categoryId: r.food_category_id });
  }
  log(`${dataType} foods: ${foods.size}`);

  const nutrients = await readNutrients(z, new Set(foods.keys()));
  const portions = dataset === "usda_branded" ? new Map() : await readPortions(z);

  let kept = 0, skipped = 0;
  for (const [id, food] of foods) {
    const b = branded.get(id);
    let category, servings = [], allergens;
    if (b) {
      category = brandedCategory(b.category, food.description);
      if (b.servingSize > 0 && (b.servingUnit === "g" || b.servingUnit === "grm" || b.servingUnit === "ml" || b.servingUnit === "mlt")) {
        const unit = b.servingUnit.startsWith("m") ? "ml" : "g";
        const hh = b.household && !/^[\d.\s]+(g|ml|grm)?$/i.test(b.household) ? b.household : "1 serving";
        servings.push({ label: unit === "ml" ? `${hh} (${b.servingSize} ml)` : hh, grams: b.servingSize });
      }
      allergens = allergensFromText(b.ingredients || food.description);
    } else {
      const catText = dataset === "usda_survey" ? surveyCat.get(id) : categories.get(food.categoryId);
      category = categorize(catText, food.description);
      servings = (portions.get(id) ?? []).map(({ label, grams }) => ({ label, grams }));
      allergens = allergensFromText(food.description);
    }
    const row = clean(
      {
        source_ref: id,
        name: b ? dropRepeatedSuffix(tidyName(food.description)) : food.description,
        brand: b?.brand ?? null,
        category,
        barcode: b?.barcode ?? null,
        branded: Boolean(b),
        ...values(nutrients.get(id)),
        allergens,
        servings,
      },
      { label: Boolean(b) },
    );
    if (!row) { skipped++; continue; }
    emit(row);
    kept++;
  }
  z.zip.close();
  return { kept, skipped };
}
