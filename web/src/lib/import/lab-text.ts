// Reads lab results out of the text of a lab report, without AI. Pure and
// deterministic: every value it proposes is a number that is literally on the
// line it quotes, so it can miss a value but never invent one. The dietitian
// reviews and approves everything before it is saved.

import { labTest } from "../labs";

export type LabCandidate = {
  test: string; // id from LAB_TESTS
  value: number; // in the app's unit for the test
  unit: string;
  original: { value: number; unit: string | null }; // as printed
  converted: boolean;
  line: string; // the line it was read from
  warnings: string[];
  // Ticked in the review only when nothing looks off.
  confident: boolean;
};

// Names labs print for each test (lowercase). Longer, more specific names first.
const ALIASES: Record<string, string[]> = {
  hba1c: ["glycated haemoglobin", "glycated hemoglobin", "glycosylated hemoglobin", "hemoglobin a1c", "haemoglobin a1c", "hb a1c", "hba1c", "a1c"],
  glucose: ["fasting blood glucose", "fasting plasma glucose", "fasting blood sugar", "fasting glucose", "glucose fasting", "glucose, fasting", "fbs", "fbg", "glucose"],
  insulin: ["fasting insulin", "insulin fasting", "insulin"],
  cholesterol: ["total cholesterol", "cholesterol total", "cholesterol, total", "cholesterol"],
  ldl: ["ldl cholesterol", "ldl-cholesterol", "ldl-c", "ldl chol", "low density lipoprotein", "ldl"],
  hdl: ["hdl cholesterol", "hdl-cholesterol", "hdl-c", "hdl chol", "high density lipoprotein", "hdl"],
  triglycerides: ["triglycerides", "triglyceride", "tg"],
  vitamin_d: ["25-hydroxy vitamin d", "25-oh vitamin d", "25(oh) vitamin d", "25 oh vitamin d", "vitamin d total", "vitamin d3", "vitamin d", "vit d", "25(oh)d", "25-oh-d"],
  b12: ["vitamin b12", "vitamin b 12", "vit b12", "cobalamin", "b12"],
  ferritin: ["ferritin"],
  hemoglobin: ["haemoglobin", "hemoglobin", "hgb", "hb"],
  tsh: ["thyroid stimulating hormone", "tsh"],
  creatinine: ["creatinine"],
  alt: ["alanine aminotransferase", "alt (sgpt)", "sgpt", "alt"],
  uric_acid: ["uric acid"],
};

// Lines about these aren't the test itself ("LDL/HDL ratio", "HbA1c estimated average glucose").
const NOT_THE_TEST = /\b(ratio|estimated average|eag|non[- ]hdl|vldl|urine|urinary|clearance|egfr|mean corpuscular|mch|mchc|bilirubin|free t4|ft4|ft3)\b/i;

// Unit as printed -> factor to the app's unit (value x factor), per test.
// Only fixed, standard factors; anything else is kept as printed and flagged.
type Conv = { unit: RegExp; factor?: number; convert?: (v: number) => number; label: string };
const UNITS: Record<string, Conv[]> = {
  hba1c: [
    { unit: /^%$/, factor: 1, label: "%" },
    // IFCC mmol/mol -> NGSP % (master equation)
    { unit: /^mmol\/mol$/, convert: (v) => 0.09148 * v + 2.152, label: "mmol/mol" },
  ],
  glucose: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 18.016, label: "mmol/L" },
  ],
  insulin: [
    { unit: /^(µ|u|μ|m)iu\/ml$|^uu\/ml$|^µu\/ml$|^mu\/l$/, factor: 1, label: "µIU/mL" },
    { unit: /^pmol\/l$/, factor: 1 / 6, label: "pmol/L" },
  ],
  cholesterol: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 38.67, label: "mmol/L" },
  ],
  ldl: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 38.67, label: "mmol/L" },
  ],
  hdl: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 38.67, label: "mmol/L" },
  ],
  triglycerides: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 88.57, label: "mmol/L" },
  ],
  vitamin_d: [
    { unit: /^ng\/ml$/, factor: 1, label: "ng/mL" },
    { unit: /^nmol\/l$/, factor: 1 / 2.496, label: "nmol/L" },
  ],
  b12: [
    { unit: /^pg\/ml$|^ng\/l$/, factor: 1, label: "pg/mL" },
    { unit: /^pmol\/l$/, factor: 1.355, label: "pmol/L" },
  ],
  ferritin: [{ unit: /^ng\/ml$|^(µ|u|μ)g\/l$/, factor: 1, label: "ng/mL" }],
  hemoglobin: [
    { unit: /^g\/dl$/, factor: 1, label: "g/dL" },
    { unit: /^g\/l$/, factor: 0.1, label: "g/L" },
  ],
  tsh: [{ unit: /^(µ|u|μ|m)iu\/ml$|^miu\/l$|^(µ|u|μ)iu\/l$/, factor: 1, label: "mIU/L" }],
  creatinine: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^(µ|u|μ)mol\/l$/, factor: 1 / 88.4, label: "µmol/L" },
  ],
  alt: [{ unit: /^(u|iu)\/l$/, factor: 1, label: "U/L" }],
  uric_acid: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^(µ|u|μ)mol\/l$/, factor: 1 / 59.48, label: "µmol/L" },
  ],
};

// Physically plausible values in the app's unit. Outside them it is almost
// surely a misread or a different test, so it is flagged and left unticked.
const PLAUSIBLE: Record<string, [number, number]> = {
  hba1c: [3, 20], glucose: [20, 1000], insulin: [0.2, 500], cholesterol: [50, 700], ldl: [5, 500], hdl: [5, 200],
  triglycerides: [10, 5000], vitamin_d: [2, 250], b12: [50, 5000], ferritin: [1, 10000], hemoglobin: [3, 25],
  tsh: [0.001, 200], creatinine: [0.1, 25], alt: [1, 5000], uric_acid: [0.5, 25],
};

const NUM = /(^|[^\w.])([<>≤≥]?\s?\d+(?:[.,]\d+)?)(?![\w.])/g;
const UNIT_TOKEN = /(%|[µμu]?[a-z]*\/[a-z]+|[µμ]?iu\/m?l)/i;

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

function findAlias(lower: string): { test: string; end: number } | null {
  let best: { test: string; start: number; end: number; len: number } | null = null;
  for (const [test, names] of Object.entries(ALIASES)) {
    for (const n of names) {
      const re = new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
      const m = re.exec(lower);
      if (!m) continue;
      const start = m.index + m[1].length;
      // The earliest name on the line wins; on a tie, the longest.
      if (!best || start < best.start || (start === best.start && n.length > best.len)) best = { test, start, end: start + n.length, len: n.length };
    }
  }
  return best ? { test: best.test, end: best.end } : null;
}

// Numbers after the test name, skipping the reference range ("4.0 - 5.6", "< 200" after the value).
function valueAfter(rest: string): { raw: string; value: number; index: number; censored: boolean } | null {
  // Remove bracketed name parts like "(25-OH)" or "(SGPT)" at the start.
  const cleaned = rest.replace(/^\s*[:\-]?\s*(\([^)]*\)\s*)*/, (m) => " ".repeat(m.length));
  NUM.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUM.exec(cleaned))) {
    const raw = m[2].replace(/\s/g, "");
    const at = m.index + m[1].length;
    const after = cleaned.slice(at + m[2].length);
    // Start of a range "4.0 - 5.6" / "4.0–5.6": that's the reference range, not the result.
    if (/^\s*[-–—]\s*\d/.test(after)) return null;
    const n = Number(raw.replace(/^[<>≤≥]/, "").replace(",", "."));
    if (!Number.isFinite(n)) continue;
    return { raw, value: n, index: at + m[2].length, censored: /^[<>≤≥]/.test(raw) };
  }
  return null;
}

export function readLabLines(lines: string[]): LabCandidate[] {
  const out: LabCandidate[] = [];
  const seen = new Set<string>();
  for (const rawLine of lines) {
    const line = normalize(rawLine);
    if (line.length < 3 || line.length > 220) continue;
    const lower = line.toLowerCase();
    const hit = findAlias(lower);
    if (!hit) continue;
    // Ratios, urine tests and the like are different measurements: skipped
    // (a missed value is safe, a mislabelled one is not).
    if (NOT_THE_TEST.test(lower)) continue;
    const rest = line.slice(hit.end);
    const v = valueAfter(rest);
    if (!v) continue;

    const def = labTest(hit.test);
    const unitText = (rest.slice(v.index).match(UNIT_TOKEN)?.[1] ?? "").toLowerCase().replace("μ", "µ");
    const conv = (UNITS[hit.test] ?? []).find((c) => c.unit.test(unitText));
    const warnings: string[] = [];
    let value = v.value;
    let converted = false;
    let unit = def?.unit ?? unitText;

    if (conv) {
      if (conv.convert) value = conv.convert(v.value);
      else value = v.value * (conv.factor ?? 1);
      converted = Boolean(conv.convert) || conv.factor !== 1;
      if (converted) warnings.push(`Converted from ${v.value} ${conv.label}.`);
    } else if (unitText) {
      unit = unitText;
      warnings.push(`Unit "${unitText}" not recognised for ${def?.label ?? hit.test}: check the value and unit.`);
    } else {
      warnings.push("No unit found on this line: check the unit.");
    }
    if (v.censored) warnings.push(`Printed as "${v.raw}" (a limit, not an exact value).`);
    const range = PLAUSIBLE[hit.test];
    if (conv && range && (value < range[0] || value > range[1])) warnings.push("This value is outside what is physically plausible: probably a misread or a different test.");

    const rounded = Math.round(value * 100) / 100;
    const key = `${hit.test}|${rounded}`;
    if (seen.has(key)) continue; // the same result printed twice (summary and detail)
    seen.add(key);
    out.push({
      test: hit.test,
      value: rounded,
      unit,
      original: { value: v.value, unit: unitText || null },
      converted,
      line,
      warnings,
      confident: warnings.length === 0 || (warnings.length === 1 && converted),
    });
  }
  return out;
}

// ---- Report date and patient name -------------------------------------------

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function toIso(y: number, m: number, d: number) {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function datesIn(line: string): { iso: string; at: number }[] {
  const out: { iso: string; at: number }[] = [];
  for (const m of line.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const iso = toIso(+m[1], +m[2], +m[3]);
    if (iso) out.push({ iso, at: m.index ?? 0 });
  }
  for (const m of line.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    // Lebanese and most international reports print day first; switch only when it can't be a day/month.
    const a = +m[1], b = +m[2];
    const iso = a > 12 || b <= 12 ? toIso(+m[3], b, a) : toIso(+m[3], a, b);
    if (iso) out.push({ iso, at: m.index ?? 0 });
  }
  for (const m of line.matchAll(/\b(\d{1,2})[\s-]([a-z]{3,4})[a-z]*[\s-,]+(\d{4})\b/gi)) {
    const mon = MONTHS[m[2].toLowerCase()];
    const iso = mon ? toIso(+m[3], mon, +m[1]) : null;
    if (iso) out.push({ iso, at: m.index ?? 0 });
  }
  return out;
}

// The sample/report date. Each date is judged by the label just before it:
// collection dates first, then report dates; birth dates never count.
export function reportDate(lines: string[], today: string): string | null {
  const scored: { iso: string; score: number }[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const { iso, at } of datesIn(line)) {
      if (iso > today) continue;
      const label = lower.slice(Math.max(0, at - 28), at);
      if (/(birth|dob|born|d\.o\.b)/.test(label)) continue;
      const score = /(collect|sampl|drawn|specimen)/.test(label) ? 3 : /(report|result|received|registered|date)/.test(label) ? 2 : 1;
      scored.push({ iso, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || b.iso.localeCompare(a.iso));
  return scored[0]?.iso ?? null;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Whether the patient's name is in the document: "match" when every part of it is.
export function nameCheck(text: string, fullName: string): "match" | "partial" | "missing" {
  const doc = fold(text);
  const parts = fold(fullName).split(/\s+/).filter((p) => p.length >= 3);
  if (!parts.length) return "missing";
  const found = parts.filter((p) => new RegExp(`(^|[^a-z])${p.replace(/[^a-z]/g, "")}([^a-z]|$)`).test(doc)).length;
  return found === parts.length ? "match" : found > 0 ? "partial" : "missing";
}
