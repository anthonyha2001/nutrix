// DATABASE_URL=postgres://... npm run load [dataset ...]   (default: the default datasets that are built)
// Copies out/<dataset>.tsv into public.food_import_stage, then calls
// public.food_import_apply(), which upserts into foods, replaces servings and
// archives rows the dataset dropped. Needs a role that bypasses RLS (postgres).
// On Supabase use the direct or session-pooler connection string, not the
// transaction pooler.
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { DEFAULT, OUT_DIR, pick } from "./datasets.mjs";
import { STAGE_COLUMNS } from "./normalize.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (local: postgresql://postgres:postgres@127.0.0.1:54422/postgres).");
  process.exit(1);
}

const args = process.argv.slice(2);
const names = args.length ? pick(args) : DEFAULT.filter((n) => existsSync(join(OUT_DIR, `${n}.tsv`)));

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query("set statement_timeout = 0");

for (const name of names) {
  const tsv = join(OUT_DIR, `${name}.tsv`);
  if (!existsSync(tsv)) {
    console.error(`${name}: ${tsv} is missing. Run: npm run build ${name}`);
    process.exitCode = 1;
    continue;
  }
  const meta = JSON.parse(readFileSync(join(OUT_DIR, `${name}.json`), "utf8"));
  const started = Date.now();
  await client.query("begin");
  try {
    await client.query("delete from public.food_import_stage where dataset = $1", [name]);
    console.log(`${name}: copying ${meta.kept.toLocaleString()} rows`);
    await pipeline(
      createReadStream(tsv),
      client.query(copyFrom(`copy public.food_import_stage (${STAGE_COLUMNS.join(", ")}) from stdin`)),
    );
    await client.query("analyze public.food_import_stage");
    console.log(`${name}: applying`);
    const { rows } = await client.query("select public.food_import_apply($1, $2) as n", [name, meta.version]);
    await client.query("commit");
    console.log(`${name}: ${Number(rows[0].n).toLocaleString()} active foods (${Math.round((Date.now() - started) / 1000)}s)`);
  } catch (err) {
    await client.query("rollback");
    console.error(`${name}: failed, nothing changed. ${err.message}`);
    process.exitCode = 1;
  }
}

await client.query("analyze public.foods");
const { rows } = await client.query("select id, food_count from public.food_datasets order by food_count desc");
console.table(rows);
await client.end();
