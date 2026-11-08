// Shared rules that turn a row from any dataset into a Nutrix food (per 100 g).
// Every dataset goes through clean(), which drops rows the database would
// reject or that are obviously wrong, so one bad label never blocks an import.

const ALLERGENS = ["gluten", "dairy", "egg", "peanut", "tree_nut", "sesame", "soy", "fish", "shellfish"];

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").replace(/^</, "").trim());
  return Number.isFinite(n) ? n : null;
};

const r2 = (n) => (n === null ? null : Math.round(n * 100) / 100);

// "CHOCOLATE CHIP COOKIES" -> "Chocolate chip cookies". Mixed-case names are kept.
export function tidyName(s, max = 200) {
  if (!s) return "";
  let t = String(s).replace(/\s+/g, " ").trim();
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    t = t.toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase());
  }
  return t.slice(0, max).trim();
}

export function tidyBrand(s) {
  if (!s) return null;
  const first = String(s).split(",")[0];
  const t = tidyName(first, 120).replace(/(^|[\s\-/(&.])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
  return t || null;
}

export function barcode(s) {
  if (!s) return null;
  const d = String(s).replace(/\D/g, "");
  return d.length >= 6 && d.length <= 14 ? d : null;
}

// Validates and rounds. Returns null when the row should be skipped.
// `label` rows (manufacturer labels, crowd-sourced) also get an energy check.
export function clean(food, { label = false } = {}) {
  const name = tidyName(food.name);
  if (!name) return null;
  let kcal = num(food.kcal);
  let p = num(food.protein_g), c = num(food.carbs_g), f = num(food.fat_g);
  // Lab datasets often omit a macro that is effectively zero (carbs in meat, protein in
  // oil). With energy known, derive the one missing macro from it. Never for labels.
  const missing = [p, c, f].filter((v) => v === null).length;
  if (!label && missing === 1 && kcal !== null) {
    // Zero when zero already explains the energy (the residual is rounding and
    // food-specific Atwater factors); otherwise what the remaining energy implies.
    const fill = (rest, factor) =>
      Math.abs(kcal - rest) <= Math.max(10, 0.1 * kcal) ? 0 : Math.max(0, Math.round(((kcal - rest) / factor) * 100) / 100);
    if (p === null) p = fill(4 * c + 9 * f, 4);
    else if (c === null) c = fill(4 * p + 9 * f, 4);
    else f = fill(4 * p + 4 * c, 9);
  }
  if (p === null || c === null || f === null) return null;
  for (const v of [p, c, f]) if (v < 0 || v > 100) return null;
  if (p + c + f > 102) return null;
  const est = 4 * p + 4 * c + 9 * f;
  if (kcal === null) kcal = est;
  if (kcal < 0 || kcal > 900) return null;
  if (label) {
    // Labels round, use 2 kcal/g fibre, polyols and alcohol: allow a wide margin,
    // but drop rows whose energy can't be reconciled with their macros at all.
    const diff = Math.abs(kcal - est);
    if (diff > Math.max(40, 0.35 * Math.max(kcal, est))) return null;
  }
  const opt = (v, max) => {
    const n = num(v);
    return n === null || n < 0 || n > max ? null : r2(n);
  };
  let sugar = opt(food.sugar_g, 100);
  if (sugar !== null && sugar > c + 0.5) sugar = null;
  let fiber = opt(food.fiber_g, 100);
  return {
    ...food,
    name,
    brand: food.brand ? String(food.brand).slice(0, 120) : null,
    category: food.category || "Other",
    kcal: r2(kcal),
    protein_g: r2(p),
    carbs_g: r2(c),
    fat_g: r2(f),
    fiber_g: fiber,
    sugar_g: sugar,
    sodium_mg: opt(food.sodium_mg, 100000),
    allergens: (food.allergens ?? []).filter((a) => ALLERGENS.includes(a)),
    servings: (food.servings ?? [])
      .filter((s) => s && s.label && Number(s.grams) > 0 && Number(s.grams) <= 5000)
      .map((s) => ({ label: tidyName(s.label, 120), grams: r2(Number(s.grams)) }))
      .filter((s, i, all) => s.label && all.findIndex((o) => o.label === s.label) === i)
      .slice(0, 12),
  };
}

// ---- Allergens matched from text (ingredients when there are any, else the name).

const ALLERGEN_RULES = [
  ["gluten", /\b(wheat|barley|rye|spelt|semolina|durum|farina|couscous|bulgur|bulghur|seitan|gluten|malt|triticale|kamut|freekeh|breadcrumbs?|flour)\b/i, /\b(buckwheat|rice flour|corn flour|almond flour|coconut flour|gluten[- ]free|chickpea flour|potato flour|tapioca flour|soy flour|oat flour)\b/i],
  ["dairy", /\b(milk|whey|casein|caseinate|butter|buttermilk|cheese|cream|yogh?urt|lactose|ghee|labneh|kefir|curds?|custard)\b/i, /\b(coconut milk|almond milk|soy milk|oat milk|rice milk|cocoa butter|peanut butter|nut butter|shea butter|cashew milk|dairy[- ]free|cream of tartar|ice cream cone)\b/i],
  ["egg", /\b(eggs?|albumen|egg white|egg yolk|mayonnaise|meringue)\b/i, /\b(eggplant|egg[- ]free)\b/i],
  ["peanut", /\b(peanuts?|groundnuts?)\b/i, /\bpeanut[- ]free\b/i],
  ["tree_nut", /\b(almonds?|cashews?|walnuts?|pecans?|hazelnuts?|filberts?|pistachios?|macadamias?|brazil nuts?|pine nuts?|pignolia|praline|marzipan|nougat|gianduja)\b/i, /\b(nut[- ]free|almond extract flavou?r)\b/i],
  ["sesame", /\b(sesame|tahini|tahina|halva|halawa|za'?atar)\b/i, null],
  ["soy", /\b(soy|soya|soybeans?|tofu|tempeh|edamame|miso|lecithin \(soy\))\b/i, null],
  ["fish", /\b(fish|anchov(y|ies)|salmon|tuna|cod|haddock|sardines?|mackerel|trout|tilapia|halibut|herring|pollock|bass|snapper|catfish|swordfish|carp|perch|sole|flounder|hake|bonito|surimi)\b/i, /\b(fish sauce free|shellfish)\b/i],
  ["shellfish", /\b(shrimps?|prawns?|crabs?|lobsters?|crayfish|crawfish|langoustines?|clams?|mussels?|oysters?|scallops?|squid|calamari|octopus|shellfish|krill)\b/i, null],
];

export function allergensFromText(text) {
  if (!text) return [];
  const out = [];
  for (const [tag, yes, no] of ALLERGEN_RULES) {
    if (!yes.test(text)) continue;
    // Only a negative phrase cancels when the positive word has no other occurrence.
    if (no && no.test(text) && !yes.test(text.replace(new RegExp(no.source, "gi"), " "))) continue;
    out.push(tag);
  }
  return out;
}

// Open Food Facts allergen tags.
const OFF_ALLERGENS = {
  "en:gluten": "gluten", "en:milk": "dairy", "en:eggs": "egg", "en:peanuts": "peanut", "en:nuts": "tree_nut",
  "en:sesame-seeds": "sesame", "en:soybeans": "soy", "en:fish": "fish", "en:crustaceans": "shellfish", "en:molluscs": "shellfish",
};
export function allergensFromOff(tags) {
  if (!tags) return [];
  return [...new Set(String(tags).split(",").map((t) => OFF_ALLERGENS[t.trim()]).filter(Boolean))];
}

// ---- Categories. Every dataset maps into the categories the app already uses.

const CATEGORY_RULES = [
  ["Baby foods", /\b(baby|infant|toddler|babyfood)\b/i],
  ["Fast food", /\b(fast[- ]?foods?)\b/i],
  ["Supplements & sports", /\b(supplement|protein powder|whey protein|sports nutrition|protein shake|meal replacement|energy gel|vitamin|creatine|pre-?workout)\b/i],
  ["Beverages", /\b(beverages?|drinks?|juices?|nectars?|sodas?|soft drinks?|colas?|water|teas?|coffee|smoothies?|lemonade|energy drink|wines?|beers?|spirits|liquor|alcoholic|kombucha|iced tea|plant[- ]based milks?|almond milk|oat milk|soy milk)\b/i],
  ["Nuts & seeds", /\b(peanut butter|nut butters?|almond butter|cashew butter|hazelnut spread|tahini|tahina)\b/i],
  ["Breakfast cereals", /\b(breakfast cereals?|ready[- ]to[- ]eat cereals?|cold cereals?|hot cereals?|cereal bars?|granola|muesli|cornflakes|oatmeal|porridge)\b/i],
  ["Dairy & eggs", /\b(dairy|dairies|milks?|cheeses?|yogh?urts?|cream|butter|kefir|labneh|eggs?|custard|ice creams?|frozen desserts?)\b/i],
  ["Baked goods", /\b(bread|breads|bakery|baked|biscuits?|cookies?|crackers?|cakes?|pastr(y|ies)|muffins?|bagels?|croissants?|pies?|tortillas?|waffles?|pancakes?|donuts?|doughnuts?|rolls|buns|pita|kaak|manakish|viennoiseries?|rusks?)\b/i],
  ["Sweets", /\b(sweets?|cand(y|ies)|chocolates?|confectioner(y|ies)|desserts?|sugars?|syrups?|honey|jams?|jell(y|ies)|marmalades?|spreads? sweet|gum|puddings?|halva|halawa|maamoul|baklava|sorbets?|toffee|caramels?|marshmallows?)\b/i],
  ["Snacks", /\b(snacks?|chips|crisps|popcorn|pretzels?|bars?|trail mix|puffs|rice cakes?)\b/i],
  ["Nuts & seeds", /\b(nuts?|seeds?|almonds?|peanuts?|cashews?|walnuts?|pistachios?|hazelnuts?|tahini|nut butters?|peanut butter)\b/i],
  ["Legumes", /\b(legumes?|pulses?|beans?|lentils?|chickpeas?|hummus|houmous|falafel|peas|tofu|soy(beans)?|tempeh|fava|foul|ful medames)\b/i],
  ["Fish & seafood", /\b(fish|finfish|shellfish|crustaceans?|mollusks?|molluscs?|clams?|scallops?|octopus|cuttlefish|crayfish|whelks?|abalone|seafoods?|salmon|tuna|sardines?|shrimps?|prawns?|crabs?|lobsters?|mussels?|oysters?|squid|cod|anchov(y|ies)|mackerel|trout)\b/i],
  ["Sausages & cold cuts", /\b(sausages?|cold cuts?|deli meats?|hot dogs?|frankfurters?|salami|ham|bacon|pepperoni|bologna|chorizo|mortadella|pastrami|luncheon|charcuterie|basterma|sujuk|soujouk|prepared meats?)\b/i],
  ["Poultry", /\b(poultry|chicken|turkey|duck|goose|hens?|quail)\b/i],
  ["Beef", /\b(beef|veal|steak|burgers? patt(y|ies)|ground beef)\b/i],
  ["Pork", /\b(pork)\b/i],
  ["Lamb, veal & game", /\b(lamb|mutton|goat|game|venison|bison|rabbit|elk)\b/i],
  ["Soups & sauces", /\b(soups?|broths?|stocks?|sauces?|dressings?|condiments?|ketchup|mustard|mayonnaise|vinegars?|gravy|salsa|pesto|dips?|marinades?)\b/i],
  ["Fats & oils", /\b(fats?|oils?|margarine|shortening|lard|ghee)\b/i],
  ["Spices & herbs", /\b(spices?|herbs?|seasonings?|salt|pepper|cinnamon|cumin|za'?atar|sumac|paprika)\b/i],
  ["Grains & pasta", /\b(grains?|pasta|noodles?|rice|couscous|bulgur|burghul|quinoa|flours?|oats|semolina|cereal grains?|freekeh|starches?)\b/i],
  ["Fruits", /\b(fruits?|apples?|bananas?|berr(y|ies)|oranges?|grapes?|dates|figs?|mangos?|peaches?|pears?|plums?|apricots?|cherr(y|ies)|melons?|citrus|raisins?|pomegranates?|dried fruits?)\b/i],
  ["Vegetables", /\b(vegetables?|veg|salads?|potato(es)?|tomato(es)?|onions?|carrots?|spinach|lettuce|cucumbers?|peppers?|cabbage|broccoli|cauliflower|eggplants?|aubergines?|zucchini|courgettes?|mushrooms?|pickles?|olives?|greens)\b/i],
  ["Prepared meals", /\b(meals?|dishes|dinners?|entrees?|pizzas?|sandwich(es)?|wraps?|burritos?|lasagn[ae]|ready[- ]to[- ]eat|frozen meals?|mixed dishes|casseroles?|stews?|quiches?|dumplings?|sushi)\b/i],
];

export function categorize(...texts) {
  for (const text of texts) {
    if (!text) continue;
    for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return cat;
  }
  return "Other";
}

// ---- COPY text format writer (tab separated, \N for null).

const esc = (v) =>
  v === null || v === undefined
    ? "\\N"
    : String(v)
        // Postgres text can't hold NUL; some OFF names have NULs in place of accented letters.
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r");

const pgArray = (arr) => "{" + arr.map((a) => `"${String(a).replace(/["\\]/g, "\\$&")}"`).join(",") + "}";

export const STAGE_COLUMNS = [
  "dataset", "source_ref", "name", "brand", "category", "barcode", "branded",
  "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg", "allergens", "servings",
];

export function copyLine(dataset, f) {
  return [
    dataset, f.source_ref, f.name, f.brand, f.category, f.barcode ?? null, f.branded ? "t" : "f",
    f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, f.sugar_g, f.sodium_mg,
    pgArray(f.allergens), JSON.stringify(f.servings),
  ].map(esc).join("\t") + "\n";
}
