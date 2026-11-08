// npm run download [dataset ...]   (default: all)
// Saves each dataset under FOODS_DATA_DIR (default foods-import/.cache). Existing files are kept;
// pass --force to download again.
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DATA_DIR, DATASETS, pick } from "./datasets.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");

for (const name of pick(args.filter((a) => !a.startsWith("--")))) {
  const d = DATASETS[name];
  const dest = join(DATA_DIR, d.file);
  if (existsSync(dest) && !force) {
    console.log(`${name}: have ${dest} (${(statSync(dest).size / 1e6).toFixed(0)} MB)`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  console.log(`${name}: downloading ${d.url}`);
  const res = await fetch(d.url, { headers: { "user-agent": "nutrix-foods-import/0.1" } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest + ".part"));
  renameSync(dest + ".part", dest);
  console.log(`${name}: saved ${(statSync(dest).size / 1e6).toFixed(0)} MB`);
}
