// npm run build [dataset ...]   (default: generic datasets + regional Open Food Facts; "all" adds usda_branded)
// Turns each downloaded dataset into out/<dataset>.tsv (Postgres COPY format for
// public.food_import_stage) plus out/<dataset>.json with counts.
import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { DATA_DIR, DATASETS, OFF_COUNTRIES, OUT_DIR, pick } from "./datasets.mjs";
import { copyLine } from "./normalize.mjs";

mkdirSync(OUT_DIR, { recursive: true });

// Barcodes already covered by USDA Branded (leading zeros stripped).
async function usdaBarcodes() {
  const set = new Set();
  const file = join(OUT_DIR, "usda_branded.tsv");
  if (!existsSync(file)) return set;
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    const code = line.split("\t")[5];
    if (code && code !== "\\N") set.add(code.replace(/^0+/, ""));
  }
  return set;
}

const names = pick(process.argv.slice(2));
for (const name of names) {
  const d = DATASETS[name];
  const input = join(DATA_DIR, d.file);
  if (!existsSync(input)) {
    console.error(`${name}: ${input} is missing. Run: npm run download ${name}`);
    process.exitCode = 1;
    continue;
  }
  const started = Date.now();
  console.log(`${name}: building from ${input}`);
  const out = createWriteStream(join(OUT_DIR, `${name}.tsv`));
  const refs = new Set();
  let dupes = 0;
  const emit = (row) => {
    if (refs.has(row.source_ref)) { dupes++; return; }
    refs.add(row.source_ref);
    if (!out.write(copyLine(name, row))) {
      // Keep memory flat: the writer drains between synchronous batches.
    }
  };
  const { build } = await import(d.module);
  const extra = name === "openfoodfacts" ? {
     // Only when USDA Branded is built in the same run, i.e. will be loaded too.
    skipBarcodes: names.includes("usda_branded") ? await usdaBarcodes() : new Set(), countries: OFF_COUNTRIES } : {};
  const result = await build(name, input, emit, (m) => console.log(`${name}: ${m}`), extra);
  await new Promise((r) => out.end(r));
  const summary = { dataset: name, version: d.version ?? new Date().toISOString().slice(0, 10), ...result, duplicateRefs: dupes, seconds: Math.round((Date.now() - started) / 1000) };
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(summary, null, 2));
  console.log(`${name}: ${result.kept.toLocaleString()} foods kept, ${result.skipped.toLocaleString()} skipped (${summary.seconds}s)`);
}
