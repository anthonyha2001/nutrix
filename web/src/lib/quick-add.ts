// Quick typing in the plan builder: "2 eggs, 1 pita, labneh 30 g, 1 cup rice"
// becomes foods with amounts. Pure and client-safe: this file only splits the
// text and works out amounts; the foods themselves come from the normal food
// search, and every line is shown for review before it is added.

import type { FoodHit, PlanItem } from "./nutrition";
import { foodToItem } from "./nutrition";

export type QuickLine = { raw: string; name: string; qty: number | null; unit: Unit | null };

type Unit = "g" | "kg" | "ml" | "l" | "cup" | "tbsp" | "tsp" | "slice" | "piece" | "bowl" | "glass" | "handful" | "can" | "serving";

// Words people type for each unit (English, French), folded to lowercase.
const UNIT_WORDS: [RegExp, Unit][] = [
  [/^(g|gr|grs|gram|grams|gramme|grammes)$/, "g"],
  [/^(kg|kilo|kilos|kilogram|kilograms)$/, "kg"],
  [/^(ml|millilitre|milliliter|millilitres|milliliters)$/, "ml"],
  [/^(l|litre|liter|litres|liters)$/, "l"],
  [/^(cup|cups|c|tasse|tasses)$/, "cup"],
  [/^(tbsp|tbs|tablespoon|tablespoons|cas|c\.a\.s|cuillere a soupe|cuilleres a soupe)$/, "tbsp"],
  [/^(tsp|teaspoon|teaspoons|cac|c\.a\.c|cuillere a cafe|cuilleres a cafe)$/, "tsp"],
  [/^(slice|slices|tranche|tranches)$/, "slice"],
  [/^(piece|pieces|pc|pcs|morceau|morceaux|unit|units)$/, "piece"],
  [/^(bowl|bowls|bol|bols)$/, "bowl"],
  [/^(glass|glasses|verre|verres)$/, "glass"],
  [/^(handful|handfuls|poignee|poignees)$/, "handful"],
  [/^(can|cans|boite|boites)$/, "can"],
  [/^(serving|servings|portion|portions)$/, "serving"],
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, quarter: 0.25,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, demi: 0.5, "demi-": 0.5,
};
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function readNumber(token: string): number | null {
  const t = token.replace(",", ".");
  if (FRACTIONS[t] !== undefined) return FRACTIONS[t];
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac && +frac[2] > 0) return +frac[1] / +frac[2];
  const mixed = t.match(/^(\d+)([½¼¾⅓⅔])$/);
  if (mixed) return +mixed[1] + FRACTIONS[mixed[2]];
  return NUMBER_WORDS[t] ?? null;
}

const unitOf = (token: string): Unit | null => UNIT_WORDS.find(([re]) => re.test(token))?.[1] ?? null;

// "labneh 30 g" / "30g labneh" / "2 eggs" / "1 cup of rice" / "half a pita" / "rice"
export function parseQuickLine(raw: string): QuickLine | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  // "30g" -> "30 g", "1.5cups" -> "1.5 cups", but only for unit words, so
  // names that start with a digit ("7up") stay whole.
  const spaced = fold(text)
    .replace(/(\d)([a-z]+)\b/g, (m, d: string, w: string) => (unitOf(w) ? `${d} ${w}` : m))
    .replace(/([½¼¾⅓⅔])([a-z])/g, "$1 $2");
  let words = spaced.split(" ").filter(Boolean);
  let qty: number | null = null;
  let unit: Unit | null = null;

  // Leading amount: "2", "1/2", "half a", "1 cup of"
  const lead = readNumber(words[0] ?? "");
  if (lead !== null && words.length > 1) {
    qty = lead;
    words = words.slice(1);
    // "half a pita": the article after "half" is part of the amount
    if ((words[0] === "a" || words[0] === "an") && lead < 1) words = words.slice(1);
    const u = unitOf(words[0] ?? "");
    if (u && words.length > 1) {
      unit = u;
      words = words.slice(1);
      if (words[0] === "of" || words[0] === "de" || words[0] === "d'") words = words.slice(1);
    }
  } else if (words.length > 1) {
    // Trailing amount: "labneh 30 g", "rice 150g", "eggs 2"
    const last = words.at(-1)!, before = words.at(-2)!;
    const u = unitOf(last);
    if (u && readNumber(before) !== null) {
      qty = readNumber(before);
      unit = u;
      words = words.slice(0, -2);
    } else if (readNumber(last) !== null && /^\d/.test(last)) {
      qty = readNumber(last);
      words = words.slice(0, -1);
    }
  }
  const name = words.join(" ").replace(/^(of|de)\s+/, "").trim();
  if (!name) return null;
  return { raw: text, name, qty, unit };
}

// One line per food: commas, semicolons, "+" or new lines separate them.
export function splitQuickText(text: string): QuickLine[] {
  return text
    .split(/[,;\n+]/)
    .map(parseQuickLine)
    .filter((l): l is QuickLine => l !== null)
    .slice(0, 20);
}

// The serving words in a food's own serving labels ("1 cup, chopped", "1 large egg").
const SERVING_MATCH: Partial<Record<Unit, RegExp>> = {
  cup: /\bcups?\b|\btasse/,
  tbsp: /\btbsp\b|tablespoon/,
  tsp: /\btsp\b|teaspoon/,
  slice: /\bslices?\b/,
  piece: /\b(piece|medium|large|small|whole|unit|fruit|egg|loaf|pita)\b/,
  bowl: /\bbowl\b/,
  glass: /\bglass\b|\bcup\b/,
  handful: /\bhandful\b|\boz\b/,
  can: /\bcan\b/,
  serving: /\bserving\b|\bportion\b/,
};

export type QuickAmount = { item: PlanItem; note: string | null; sure: boolean };

// How much of the food the line means. "sure" is false whenever the amount
// was assumed; the review shows why.
export function quickAmount(food: FoodHit, line: QuickLine): QuickAmount {
  const qty = line.qty ?? 1;
  const grams = (g: number, note: string | null = null, sure = true): QuickAmount => ({
    item: foodToItem(food, Math.round(g * 10) / 10),
    note,
    sure,
  });
  const withServing = (label: string, unitG: number, note: string | null = null, sure = true): QuickAmount => ({
    item: foodToItem(food, Math.round(qty * unitG * 10) / 10, { label, qty, unit_g: unitG }),
    note,
    sure,
  });

  if (line.unit === "g") return grams(qty);
  if (line.unit === "kg") return grams(qty * 1000);
  if (line.unit === "ml") return grams(qty, "Millilitres counted as grams.");
  if (line.unit === "l") return grams(qty * 1000, "Litres counted as kilograms.");

  const servings = food.servings ?? [];
  if (line.unit) {
    const re = SERVING_MATCH[line.unit];
    const s = re ? servings.find((x) => re.test(fold(x.label))) : undefined;
    if (s) return withServing(s.label, s.grams);
    // The food has no serving of that kind: fall back to its first serving or 100 g, and say so.
    const first = servings[0];
    return first
      ? withServing(first.label, first.grams, `No "${line.unit}" serving for this food: check the amount.`, false)
      : grams(100 * qty, `No "${line.unit}" serving for this food: set to ${100 * qty} g, check it.`, false);
  }
  // A count with no unit ("2 eggs", "1 pita"): one piece or portion each.
  const piece = servings.find((x) => SERVING_MATCH.piece!.test(fold(x.label))) ?? servings.find((x) => /portion|serving/.test(fold(x.label))) ?? servings[0];
  if (piece) return withServing(piece.label, piece.grams, line.qty === null ? "No amount typed: one serving." : null, line.qty !== null);
  return grams(100 * qty, line.qty === null ? "No amount typed: set to 100 g." : `Set to ${100 * qty} g: check it.`, false);
}
