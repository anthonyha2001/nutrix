// Open Food Facts: the nightly CSV export (tab separated, gzipped). ODbL.
// Only products with a name and complete energy and macros per 100 g are kept,
// and products already present in USDA Branded (same barcode) are skipped.
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { allergensFromOff, allergensFromText, barcode, categorize, clean, tidyBrand } from "../normalize.mjs";

const n = (v) => (v === undefined || v === "" ? null : Number(v));

function offCategory(get) {
  // categories_tags run from general to specific ("en:plant-based-foods-and-beverages,
  // en:beverages,en:teas"); the most specific tag that maps wins.
  const tags = (get("categories_tags") || "").split(",").map((t) => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " ")).reverse();
  for (const t of tags) {
    const c = categorize(t);
    if (c !== "Other") return c;
  }
  return categorize(get("pnns_groups_2"), get("food_groups_en"), get("main_category_en"), get("product_name"));
}

export async function build(_dataset, gzPath, emit, log, { skipBarcodes = new Set(), countries = ["all"] } = {}) {
  const everywhere = countries.includes("all");
  const wanted = new Set(countries.map((c) => `en:${c}`));
  let outside = 0;
  const lines = createInterface({ input: createReadStream(gzPath).pipe(createGunzip()), crlfDelay: Infinity });
  let header = null, idx = null;
  const seen = new Set();
  let total = 0, kept = 0, skipped = 0, dupes = 0;

  for await (const line of lines) {
    if (!header) {
      header = line.split("\t");
      idx = Object.fromEntries(header.map((h, i) => [h, i]));
      for (const col of ["code", "product_name", "energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"]) {
        if (!(col in idx)) throw new Error(`Open Food Facts CSV has no "${col}" column`);
      }
      continue;
    }
    total++;
    if (total % 500000 === 0) log(`  ${total.toLocaleString()} rows read, ${kept.toLocaleString()} kept`);
    const cells = line.split("\t");
    const get = (col) => (idx[col] === undefined ? undefined : cells[idx[col]]);

    if (!everywhere && !(get("countries_tags") || "").split(",").some((t) => wanted.has(t.trim()))) { outside++; continue; }
    const code = (get("code") || "").trim();
    const name = get("product_name") || get("abbreviated_product_name") || get("generic_name");
    if (!code || !name || seen.has(code)) { skipped++; continue; }
    const bc = barcode(code);
    if (bc && skipBarcodes.has(bc.replace(/^0+/, ""))) { dupes++; continue; }

    let kcal = n(get("energy-kcal_100g"));
    if (kcal === null && n(get("energy_100g")) !== null) kcal = n(get("energy_100g")) / 4.184;
    let sodium = n(get("sodium_100g"));
    if (sodium === null && n(get("salt_100g")) !== null) sodium = n(get("salt_100g")) / 2.5;

    const servings = [];
    const sq = n(get("serving_quantity"));
    if (sq > 0) {
      const text = (get("serving_size") || "").trim();
      servings.push({ label: text ? `1 serving (${text})` : "1 serving", grams: sq });
    }
    const allergenTags = get("allergens") || get("allergens_tags");
    const row = clean(
      {
        source_ref: code,
        name,
        brand: tidyBrand(get("brands")),
        category: offCategory(get),
        barcode: bc,
        branded: true,
        kcal,
        protein_g: n(get("proteins_100g")),
        carbs_g: n(get("carbohydrates_100g")),
        fat_g: n(get("fat_100g")),
        fiber_g: n(get("fiber_100g")),
        sugar_g: n(get("sugars_100g")),
        sodium_mg: sodium === null ? null : sodium * 1000,
        allergens: allergenTags ? allergensFromOff(allergenTags) : allergensFromText(get("ingredients_text")),
        servings,
      },
      { label: true },
    );
    if (!row) { skipped++; continue; }
    seen.add(code);
    emit(row);
    kept++;
  }
  log(`  ${total.toLocaleString()} rows, ${outside.toLocaleString()} sold elsewhere, ${dupes.toLocaleString()} already in USDA Branded`);
  return { kept, skipped: skipped + dupes, outsideCountries: outside, countries };
}
