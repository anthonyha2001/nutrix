# Nutrix food library import

Builds the shared food library from open datasets and loads it into Postgres. The food rows no longer live in
migrations. The schema (`supabase/migrations/20261110000000_food_datasets.sql`) holds only the dataset register,
the staging table and the import, search and save functions. This tool supplies the data.

## What gets stored

Nutrix stores a small library: generic foods, plus packaged products sold in Lebanon and the region. Any other
product is looked up live on Open Food Facts when someone searches for it or types its barcode. It is saved only
once someone picks it for a plan, recipe or diary. So the database grows with real use, not with the world's
supermarkets.

| Dataset | Stored rows (Nov 2026) | Kind | Licence | Default |
| --- | --- | --- | --- | --- |
| USDA SR Legacy | 7,283 | generic | CC0 | in migrations |
| USDA FNDDS (Survey) 2021-2023 | 5,430 | generic, as eaten | CC0 | yes |
| USDA Foundation Foods | 367 | generic, lab analysed | CC0 | yes |
| Canadian Nutrient File 2015 | 5,676 | generic | Open Government Licence - Canada (attribution) | yes |
| Open Food Facts, Lebanon and region | 26,367 | packaged products | ODbL 1.0 + DbCL (attribution, share-alike) | yes |
| USDA Branded Foods | 417,826 | US packaged products | CC0 | no (opt-in) |
| Open Food Facts, all countries | 2,964,955 | packaged products | ODbL | no (`OFF_COUNTRIES=all`) |

**Measured** (all migrations plus the default set, in Postgres): 45,133 foods. The foods table with its search
indexes takes 34 MB, servings 10 MB, and the whole test database 66 MB. Searches take about 20 ms. The full
3.4M-row version took 4.3 GB, with some searches at 1-2 s, which is why it isn't the default.

The region is Lebanon, Syria, Jordan, Iraq, Egypt, Saudi Arabia, the UAE, Kuwait, Qatar, Bahrain, Oman,
Palestine, Cyprus and Turkey. Many products sold in Lebanon are imported from these countries and only tagged
there. Change it with `OFF_COUNTRIES=lebanon,jordan` (country tags as Open Food Facts spells them).

Attribution is shown on the Foods page, from `food_datasets.attribution`.

**Open Food Facts and ODbL.** ODbL lets Nutrix use the data commercially, but anything that is a *derivative
database* of Open Food Facts must be offered under ODbL too. Nutrix keeps OFF rows as their own dataset
(`dataset = 'openfoodfacts'`, `food_datasets.share_alike = true`) and doesn't merge them into other rows. That way
the derivative part is just the OFF rows as normalised here, and they can be published or removed in one go.
Have this reviewed before launch.

## Usage

Node 20+. From this folder:

```bash
npm install
npm run download            # the default datasets (about 1.6 GB, mostly the Open Food Facts export)
npm run build               # -> .cache/out/<dataset>.tsv + .json (counts); about 2 minutes
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npm run load
npm test                    # unit tests for the normalisation rules
```

- `FOODS_DATA_DIR` moves the cache (default `foods-import/.cache`, which is git-ignored). The downloads can be
  deleted after building; only `.cache/out/` is needed to load.
- Name datasets to do only some: `npm run build cnf usda_survey`. Use `all` to include USDA Branded. When USDA
  Branded is built in the same run, OFF products with the same barcode are skipped.
- Loading needs a role that bypasses row-level security (`postgres`). On Supabase use the direct connection or
  the session pooler, not the transaction pooler. Each dataset loads in one transaction, so a failure changes
  nothing.
- Re-running is safe. Rows are upserted by `(dataset, source_ref)`, so ids stay stable. Servings are replaced.
  Foods a dataset no longer contains are archived, never deleted, since plans, diaries and recipes may point at
  them. Products saved from an online lookup (`saved_on_use`) are never archived by an import.

## Online lookup (web app)

`web/src/lib/openfoodfacts.ts` and `searchFoodsOnline` / `saveOnlineFood` in `web/src/app/food-actions.ts`:

- **Barcode** (8-14 digits) not in the library: looked up automatically on the OFF product API.
- **Words:** the food search offers "Search Open Food Facts" when the library has few matches. OFF's search
  service finds barcodes, then each product is read from the product API. Answers are cached for 10 minutes per
  server instance.
- **Picking** an online product: the server fetches it again itself and saves it with `food_save_online` (secret
  key only), so nutrition values never come from the browser. The same acceptance rules as the importer apply.
- Needs `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) on the server. Without it the online search is
  hidden.
- OFF asks API users to stay around 100 product reads and 10 searches a minute per IP. It also asks for an
  identifying User-Agent, which is set.

## Rules applied to every row (`src/normalize.mjs`)

- **Values** are per 100 g. Rows need protein, carbs and fat between 0 and 100 g, with a sum of 102 g or less,
  and energy of 900 kcal or less. Missing energy is computed with Atwater factors (4/4/9).
- **Lab datasets** (USDA generic, CNF) often leave out a macro that is effectively zero, such as carbs in meat.
  When energy is known, that macro is 0 if zero already explains the energy. Otherwise it is derived from the
  remaining energy. Partial analyses with no energy are dropped.
- **Label datasets** (USDA Branded, OFF) also have to pass an energy check: stated kcal within
  max(40 kcal, 35%) of 4P + 4C + 9F. This drops most mistyped labels.
- **Text:** names in all capitals become sentence case, and brands are title case. A flavour repeated at the end
  of a USDA Branded name is removed. Control characters are stripped, since some OFF names contain NUL bytes,
  which Postgres rejects.
- **Categories** are mapped into the app's categories by keyword rules (`CATEGORY_RULES`), with explicit
  overrides for USDA Branded categories. OFF uses its most specific category tag.
- **Allergens:** OFF uses its declared allergen tags. USDA Branded matches its ingredient list. Generic foods
  match their name. All of these are approximate, and the UI says so.
- **Servings:** USDA portions, CNF conversion factors, and label serving sizes. Millilitre servings are treated
  as grams, with the ml kept in the label.

## Known upstream issues

- The USDA Foundation Foods release of 2026-10-29 ships without `food.csv` and `food_nutrient.csv`.
  `datasets.mjs` uses the 2026-04-30 release until USDA fixes it.

## Adding a dataset

1. Add a source in `src/sources/` that emits rows through `clean()`.
2. Add an entry in `src/datasets.mjs`.
3. Write a migration that inserts its `food_datasets` row (licence and attribution) and, if it isn't USDA, adds a
   `food_source` value and maps it in `food_import_apply`.

Candidates checked so far:
- CIQUAL (France, Etalab Open Licence): a good fit.
- UK CoFID: its API licence is CC BY-NC-SA, so no commercial use.
- AUSNUT/AFCD: a custom licence that needs reading.
- German BLS: no public licence.
