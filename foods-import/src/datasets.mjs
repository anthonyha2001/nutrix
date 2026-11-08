// Every dataset the importer knows. To add one: a source module that emits
// rows through clean(), an entry here, a row in food_datasets, and a
// food_source value if it isn't USDA.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(process.env.FOODS_DATA_DIR || join(here, "..", ".cache"));
export const OUT_DIR = join(DATA_DIR, "out");

const FDC = "https://fdc.nal.usda.gov/fdc-datasets";

// Update the USDA release dates when FoodData Central publishes a new release
// (https://fdc.nal.usda.gov/download-datasets/).
export const DATASETS = {
  usda_foundation: {
    // The 2026-10-29 Foundation zip ships without food.csv and food_nutrient.csv,
    // so this uses the previous release until USDA fixes it.
    version: "2026-04-30",
    url: `${FDC}/FoodData_Central_foundation_food_csv_2026-04-30.zip`,
    file: "usda/foundation.zip",
    module: "./sources/usda.mjs",
  },
  usda_survey: {
    version: "2024-10-31",
    url: `${FDC}/FoodData_Central_survey_food_csv_2024-10-31.zip`,
    file: "usda/survey.zip",
    module: "./sources/usda.mjs",
  },
  usda_branded: {
    version: "2026-10-29",
    url: `${FDC}/FoodData_Central_branded_food_csv_2026-10-29.zip`,
    file: "usda/branded.zip",
    module: "./sources/usda.mjs",
  },
  cnf: {
    version: "2015",
    url: "https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip",
    file: "cnf/cnf.zip",
    module: "./sources/cnf.mjs",
  },
  // Only products sold in the countries below are stored; the app looks up any
  // other product online and saves it when it is used. All countries (about 3M
  // products, several GB) with OFF_COUNTRIES=all.
  openfoodfacts: {
    version: null, // nightly; the build date is recorded
    url: "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz",
    file: "off/products.csv.gz",
    module: "./sources/off.mjs",
  },
};

// Lebanon and the markets most of its imported products come from.
export const OFF_COUNTRIES = (process.env.OFF_COUNTRIES ||
  "lebanon,syria,jordan,iraq,egypt,saudi-arabia,united-arab-emirates,kuwait,qatar,bahrain,oman,palestine,cyprus,turkey"
).split(",").map((c) => c.trim()).filter(Boolean);

// The default set fits a small database (about 100 MB with indexes).
// usda_branded (US products, ~420k rows, ~500 MB) is opt-in: npm run build usda_branded.
export const ORDER = ["usda_foundation", "usda_survey", "usda_branded", "cnf", "openfoodfacts"];
export const DEFAULT = ["usda_foundation", "usda_survey", "cnf", "openfoodfacts"];

export function pick(args) {
  const names = args.length === 0 ? DEFAULT : args.includes("all") ? ORDER : args;
  for (const n of names) if (!DATASETS[n]) throw new Error(`Unknown dataset "${n}". Known: ${ORDER.join(", ")}`);
  return ORDER.filter((n) => names.includes(n));
}
