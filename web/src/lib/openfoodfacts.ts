import "server-only";

// Live lookups on Open Food Facts (ODbL) for products that aren't stored
// locally. Only the server talks to OFF, and the same rules as the bulk importer
// (foods-import/src/normalize.mjs) decide what counts as a usable product.
// OFF rate limits per IP: about 100 product reads and 10 searches a minute, so
// text search runs only when someone asks for it, and answers are cached.

const BASE = "https://world.openfoodfacts.org";
const USER_AGENT = "Nutrix/0.1 (+https://github.com/anthonyha2001/nutrix)";
const FIELDS = "code,product_name,abbreviated_product_name,generic_name,brands,nutriments,serving_quantity,serving_size,allergens_tags,categories_tags";

export type OnlineFood = {
  code: string;
  name: string;
  brand: string | null;
  category: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  allergens: string[];
  servings: { label: string; grams: number }[];
};

type OffProduct = {
  code?: string;
  product_name?: string;
  abbreviated_product_name?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
  serving_quantity?: number | string;
  serving_size?: string;
  allergens_tags?: string[];
  categories_tags?: string[];
};

const ALLERGENS: Record<string, string> = {
  "en:gluten": "gluten", "en:milk": "dairy", "en:eggs": "egg", "en:peanuts": "peanut", "en:nuts": "tree_nut",
  "en:sesame-seeds": "sesame", "en:soybeans": "soy", "en:fish": "fish", "en:crustaceans": "shellfish", "en:molluscs": "shellfish",
};

// Most specific tag first. A short list: these rows are few and a dietitian sees the product name anyway.
const CATEGORIES: [string, RegExp][] = [
  ["Baby foods", /baby|infant/],
  ["Beverages", /beverage|drink|juice|soda|water|tea|coffee/],
  ["Breakfast cereals", /breakfast-cereal|granola|muesli/],
  ["Nuts & seeds", /nut-butter|peanut-butter|tahini|nuts|seeds/],
  ["Dairy & eggs", /dair|milk|cheese|yogurt|yoghurt|labneh|cream|butter|egg/],
  ["Baked goods", /bread|biscuit|cookie|cracker|cake|pastr|viennoiser/],
  ["Sweets", /sweet|candy|confection|chocolate|dessert|jam|honey|sugar|halva/],
  ["Snacks", /snack|chips|crisps|popcorn|bar/],
  ["Soups & sauces", /sauce|soup|condiment|dressing|dip/],
  ["Fats & oils", /oil|fat|margarine/],
  ["Fish & seafood", /fish|seafood|tuna|sardine|salmon/],
  ["Sausages & cold cuts", /sausage|cold-cut|ham|salami|mortadella/],
  ["Poultry", /chicken|turkey|poultry/],
  ["Grains & pasta", /pasta|rice|noodle|grain|flour|cereal/],
  ["Legumes", /legume|bean|lentil|chickpea|hummus/],
  ["Fruits", /fruit/],
  ["Vegetables", /vegetable|pickle|olive|tomato/],
  ["Spices & herbs", /spice|herb|seasoning|salt/],
  ["Prepared meals", /meal|dish|pizza|sandwich/],
];

const num = (v: unknown) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

function tidy(s: string, max: number) {
  let t = s.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) t = t.toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase());
  return t.slice(0, max).trim();
}

// Same acceptance rules as the importer for label data. Null when unusable.
export function toOnlineFood(p: OffProduct): OnlineFood | null {
  const code = (p.code ?? "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 14) return null;
  const name = tidy(p.product_name || p.abbreviated_product_name || p.generic_name || "", 200);
  if (!name) return null;
  const n = p.nutriments ?? {};
  const protein = num(n.proteins_100g), carbs = num(n.carbohydrates_100g), fat = num(n.fat_100g);
  if (protein === null || carbs === null || fat === null) return null;
  if ([protein, carbs, fat].some((v) => v < 0 || v > 100) || protein + carbs + fat > 102) return null;
  const est = 4 * protein + 4 * carbs + 9 * fat;
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal === null && num(n.energy_100g) !== null) kcal = (num(n.energy_100g) as number) / 4.184;
  if (kcal === null) kcal = est;
  if (kcal < 0 || kcal > 900 || Math.abs(kcal - est) > Math.max(40, 0.35 * Math.max(kcal, est))) return null;
  const opt = (v: unknown, max: number) => {
    const x = num(v);
    return x === null || x < 0 || x > max ? null : r2(x);
  };
  let sodium = num(n.sodium_100g);
  if (sodium === null && num(n.salt_100g) !== null) sodium = (num(n.salt_100g) as number) / 2.5;
  let sugar = opt(n.sugars_100g, 100);
  if (sugar !== null && sugar > carbs + 0.5) sugar = null;

  const tags = [...(p.categories_tags ?? [])].reverse().map((t) => t.replace(/^[a-z]{2}:/, ""));
  const category =
    tags.map((t) => CATEGORIES.find(([, re]) => re.test(t))?.[0]).find(Boolean) ??
    CATEGORIES.find(([, re]) => re.test(name.toLowerCase()))?.[0] ??
    "Other";
  const sq = num(p.serving_quantity);
  const brand = p.brands ? tidy(p.brands.split(",")[0], 120).replace(/(^|[\s\-/(&.])(\p{L})/gu, (_, s, c) => s + c.toUpperCase()) : null;

  return {
    code,
    name,
    brand: brand || null,
    category,
    kcal: r2(kcal),
    protein_g: r2(protein),
    carbs_g: r2(carbs),
    fat_g: r2(fat),
    fiber_g: opt(n.fiber_100g, 100),
    sugar_g: sugar,
    sodium_mg: sodium === null || sodium < 0 || sodium > 100 ? null : r2(sodium * 1000),
    allergens: [...new Set((p.allergens_tags ?? []).map((t) => ALLERGENS[t]).filter(Boolean))],
    servings: sq && sq > 0 && sq <= 5000 ? [{ label: tidy(p.serving_size ? `1 serving (${p.serving_size})` : "1 serving", 120), grams: r2(sq) }] : [],
  };
}

// Small in-memory cache per server instance, so repeated searches don't hit OFF.
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 10 * 60 * 1000;
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
  return res.json();
}

export function isBarcode(q: string) {
  return /^[0-9]{8,14}$/.test(q.trim());
}

export async function lookupBarcode(code: string): Promise<OnlineFood | null> {
  const digits = code.replace(/\D/g, "");
  if (!isBarcode(digits)) return null;
  return cached(`p:${digits}`, async () => {
    const data = await getJson(`${BASE}/api/v2/product/${digits}.json?fields=${FIELDS}`);
    return data?.product ? toOnlineFood({ ...data.product, code: data.product.code ?? digits }) : null;
  });
}

// Two steps: OFF's search service (search.openfoodfacts.org, no nutrition in
// its answers) finds the best matching barcodes, then each product is read from
// the product API, which has a far higher rate limit than OFF's legacy search
// and is cached per barcode.
export async function searchOnline(query: string, limit = 10): Promise<OnlineFood[]> {
  const q = query.trim().toLowerCase().slice(0, 80);
  if (q.length < 3) return [];
  return cached(`s:${q}`, async () => {
    const params = new URLSearchParams({ q, page_size: "30", fields: "code" });
    const data = await getJson(`https://search.openfoodfacts.org/search?${params}`);
    const codes = [...new Set(((data?.hits ?? []) as { code?: string }[]).map((h) => (h.code ?? "").replace(/\D/g, "")).filter(isBarcode))];
    // Many products lack nutrition, so read a few at a time until there are enough.
    const out: OnlineFood[] = [];
    let failed = 0;
    for (let i = 0; i < codes.length && out.length < limit; i += 5) {
      const batch = await Promise.all(codes.slice(i, i + 5).map((c) => lookupBarcode(c).catch(() => (failed++, null))));
      out.push(...batch.filter((f): f is OnlineFood => f !== null));
      if (failed >= 5) break;
    }
    // Rate-limited or down: report it rather than caching "no matches".
    if (out.length === 0 && failed > 0) throw new Error("Open Food Facts product reads failed");
    return out.slice(0, limit);
  });
}
