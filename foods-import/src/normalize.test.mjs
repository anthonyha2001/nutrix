import { test } from "node:test";
import assert from "node:assert/strict";
import { allergensFromOff, allergensFromText, barcode, categorize, clean, copyLine, tidyBrand, tidyName } from "./normalize.mjs";

const base = { source_ref: "1", name: "Test", brand: null, category: "Other", branded: false };

test("clean keeps valid rows and rounds", () => {
  const r = clean({ ...base, kcal: 100.456, protein_g: 5, carbs_g: 10.123, fat_g: 4 });
  assert.equal(r.kcal, 100.46);
  assert.equal(r.carbs_g, 10.12);
});

test("clean drops impossible values", () => {
  assert.equal(clean({ ...base, kcal: 100, protein_g: 60, carbs_g: 60, fat_g: 0 }), null, "macros over 100 g");
  assert.equal(clean({ ...base, kcal: 1200, protein_g: 0, carbs_g: 0, fat_g: 100 }), null, "energy over 900");
  assert.equal(clean({ ...base, kcal: 100, protein_g: -1, carbs_g: 10, fat_g: 1 }), null, "negative");
  assert.equal(clean({ ...base, name: "  ", kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0 }), null, "no name");
});

test("labels must roughly agree with their macros", () => {
  assert.ok(clean({ ...base, kcal: 520, protein_g: 6, carbs_g: 55, fat_g: 31 }, { label: true }));
  assert.equal(clean({ ...base, kcal: 52, protein_g: 6, carbs_g: 55, fat_g: 31 }, { label: true }), null, "kJ typed as kcal or a missing digit");
});

test("lab data: one missing macro is derived from energy, labels never", () => {
  const meat = clean({ ...base, kcal: 155, protein_g: 22.8, carbs_g: null, fat_g: 6.39 });
  assert.equal(meat.carbs_g, 0);
  assert.equal(clean({ ...base, kcal: 155, protein_g: 22.8, carbs_g: null, fat_g: 6.39 }, { label: true }), null);
  assert.equal(clean({ ...base, kcal: null, protein_g: 25, carbs_g: null, fat_g: 1 }), null, "no energy, nothing to derive from");
});

test("missing energy is computed", () => {
  assert.equal(clean({ ...base, kcal: null, protein_g: 10, carbs_g: 10, fat_g: 10 }).kcal, 170);
});

test("sugar can't exceed carbs; servings are filtered", () => {
  const r = clean({ ...base, kcal: 50, protein_g: 0, carbs_g: 10, fat_g: 0, sugar_g: 40, servings: [{ label: "1 cup", grams: 240 }, { label: "bad", grams: 0 }, { label: "1 cup", grams: 200 }] });
  assert.equal(r.sugar_g, null);
  assert.deepEqual(r.servings, [{ label: "1 cup", grams: 240 }]);
});

test("names and brands", () => {
  assert.equal(tidyName("CHOCOLATE CHIP COOKIES"), "Chocolate chip cookies");
  assert.equal(tidyName("Labneh Crème"), "Labneh Crème");
  assert.equal(tidyBrand("TRADER JOE'S,Other"), "Trader Joe's");
  assert.equal(tidyBrand("al-rifai"), "Al-Rifai");
});

test("barcodes", () => {
  assert.equal(barcode("0 12345 67890 5"), "012345678905");
  assert.equal(barcode("12"), null);
  assert.equal(barcode("123456789012345"), null);
});

test("allergens from text avoid common false positives", () => {
  assert.deepEqual(allergensFromText("Wheat flour, milk, eggs, sesame seeds"), ["gluten", "dairy", "egg", "sesame"]);
  assert.deepEqual(allergensFromText("Coconut milk, rice flour, eggplant"), []);
  assert.deepEqual(allergensFromText("Peanut butter"), ["peanut"]);
  assert.deepEqual(allergensFromText("Almond milk, milk powder"), ["dairy", "tree_nut"]);
  assert.deepEqual(allergensFromText("Buckwheat groats"), []);
});

test("allergens from Open Food Facts tags", () => {
  assert.deepEqual(allergensFromOff("en:milk,en:gluten,en:crustaceans,en:molluscs"), ["dairy", "gluten", "shellfish"]);
});

test("categories", () => {
  assert.equal(categorize("Cereal Grains and Pasta"), "Grains & pasta");
  assert.equal(categorize("Breakfast Cereals"), "Breakfast cereals");
  assert.equal(categorize("Finfish and Shellfish Products"), "Fish & seafood");
  assert.equal(categorize("peanut butter"), "Nuts & seeds");
  assert.equal(categorize("Fast Foods"), "Fast food");
  assert.equal(categorize("something unknown"), "Other");
});

test("COPY lines escape tabs, newlines and backslashes", () => {
  const r = clean({ ...base, name: "A\tB", kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, allergens: ["dairy"], servings: [{ label: 'say "hi"', grams: 1 }] });
  const line = copyLine("cnf", { ...r, brand: "x\\y" });
  const cells = line.trimEnd().split("\t");
  assert.equal(cells.length, 16);
  assert.equal(cells[3], "x\\\\y");
  assert.equal(cells[5], "\\N");
  assert.equal(cells[14], '{"dairy"}');
  assert.ok(!copyLine("cnf", { ...r, name: "Vitalit\u0000" }).includes("\u0000"), "NUL bytes removed");
});
