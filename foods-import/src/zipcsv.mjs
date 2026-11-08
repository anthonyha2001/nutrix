// Streams CSV files straight out of a zip, without unpacking it to disk.
import yauzl from "yauzl";
import { parse } from "csv-parse";

export function openZip(path) {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err) return reject(err);
      const entries = new Map();
      zip.on("entry", (e) => {
        entries.set(e.fileName.split("/").pop().toLowerCase(), e);
        zip.readEntry();
      });
      zip.on("end", () => resolve({ zip, entries }));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

export function has({ entries }, name) {
  return entries.has(name.toLowerCase());
}

// Yields each row as an object keyed by the header. `encoding` for older files (CNF is latin1).
export async function* rows({ zip, entries }, name, { encoding = "utf8", bom = true } = {}) {
  const entry = entries.get(name.toLowerCase());
  if (!entry) throw new Error(`${name} not found in zip (has: ${[...entries.keys()].join(", ")})`);
  const stream = await new Promise((resolve, reject) =>
    zip.openReadStream(entry, (err, s) => (err ? reject(err) : resolve(s))),
  );
  const parser = parse({ columns: (h) => h.map((c) => c.trim()), bom, relax_column_count: true, relax_quotes: true, encoding });
  stream.pipe(parser);
  for await (const row of parser) yield row;
}
