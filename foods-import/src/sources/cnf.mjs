// Canadian Nutrient File 2015 (Health Canada). Values per 100 g; servings come
// from conversion factors (factor x 100 g). Open Government Licence - Canada.
import { openZip, rows } from "../zipcsv.mjs";
import { allergensFromText, categorize, clean } from "../normalize.mjs";

const IDS = { 208: "kcal", 203: "protein_g", 204: "fat_g", 205: "carbs_g", 291: "fiber_g", 269: "sugar_g", 307: "sodium_mg" };

export async function build(_dataset, zipPath, emit) {
  const z = await openZip(zipPath);
  const opt = { encoding: "latin1" };

  const groups = new Map();
  for await (const r of rows(z, "FOOD GROUP.csv", opt)) groups.set(r.FoodGroupID, r.FoodGroupName);
  const measures = new Map();
  for await (const r of rows(z, "MEASURE NAME.csv", opt)) measures.set(r.MeasureID, r.MeasureDescription);

  const values = new Map();
  for await (const r of rows(z, "NUTRIENT AMOUNT.csv", opt)) {
    const slot = IDS[r.NutrientID];
    if (!slot) continue;
    const v = values.get(r.FoodID) ?? {};
    v[slot] = Number(r.NutrientValue);
    values.set(r.FoodID, v);
  }
  const servings = new Map();
  for await (const r of rows(z, "CONVERSION FACTOR.csv", opt)) {
    const label = measures.get(r.MeasureID);
    const grams = Number(r.ConversionFactorValue) * 100;
    if (!label || !(grams > 0) || /^100\s*(g|ml)$/i.test(label.trim())) continue;
    const list = servings.get(r.FoodID) ?? [];
    list.push({ label, grams });
    servings.set(r.FoodID, list);
  }

  let kept = 0, skipped = 0;
  for await (const r of rows(z, "FOOD NAME.csv", opt)) {
    const name = r.FoodDescription;
    const row = clean({
      source_ref: r.FoodID,
      name,
      brand: null,
      category: categorize(groups.get(r.FoodGroupID), name),
      barcode: null,
      branded: false,
      ...values.get(r.FoodID),
      allergens: allergensFromText(name),
      servings: servings.get(r.FoodID) ?? [],
    });
    if (!row) { skipped++; continue; }
    emit(row);
    kept++;
  }
  z.zip.close();
  return { kept, skipped };
}
