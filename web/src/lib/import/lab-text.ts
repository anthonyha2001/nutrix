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

// Lebanese reports are in English, French or Arabic. Lines are matched in a
// folded form (see fold below): lowercase, no French accents, Arabic letter
// variants unified, Arabic-Indic digits as 0-9. Names are written folded here.
// Where several names start at the same place, the longest wins
// ("hemoglobine glyquee" is HbA1c, not haemoglobin).
const ALIASES: Record<string, string[]> = {
  hba1c: [
    "glycated haemoglobin", "glycated hemoglobin", "glycosylated hemoglobin", "hemoglobin a1c", "haemoglobin a1c", "hb a1c", "hba1c", "a1c",
    "hemoglobine glyquee", "hemoglobine glycosylee", "hemoglobine a1c",
    "السكر التراكمي", "الهيموغلوبين السكري", "الهيموجلوبين السكري", "السكر المتراكم",
  ],
  glucose: [
    "fasting blood glucose", "fasting plasma glucose", "fasting blood sugar", "fasting glucose", "glucose fasting", "glucose, fasting", "fbs", "fbg", "glucose",
    "glycemie a jeun", "glycemie", "glucose a jeun",
    "سكر الدم الصيامي", "السكر الصيامي", "سكر الصيام", "سكر الدم", "الجلوكوز", "الغلوكوز",
  ],
  insulin: ["fasting insulin", "insulin fasting", "insulin", "insulinemie a jeun", "insulinemie", "insuline", "الانسولين"],
  cholesterol: [
    "total cholesterol", "cholesterol total", "cholesterol, total", "cholesterol", "cholesterol totale",
    "الكوليسترول الكلي", "الكولسترول الكلي", "الكوليسترول", "الكولسترول",
  ],
  ldl: [
    "ldl cholesterol", "ldl-cholesterol", "ldl-c", "ldl chol", "low density lipoprotein", "ldl", "cholesterol ldl", "cholesterol-ldl",
    "الكوليسترول الضار", "الكولسترول الضار",
  ],
  hdl: [
    "hdl cholesterol", "hdl-cholesterol", "hdl-c", "hdl chol", "high density lipoprotein", "hdl", "cholesterol hdl", "cholesterol-hdl",
    "الكوليسترول الجيد", "الكولسترول الجيد", "الكوليسترول النافع",
  ],
  triglycerides: ["triglycerides", "triglyceride", "tg", "الدهون الثلاثيه", "الدهون الثلاثية", "الشحوم الثلاثيه"],
  vitamin_d: [
    "25-hydroxy vitamin d", "25-oh vitamin d", "25(oh) vitamin d", "25 oh vitamin d", "vitamin d total", "vitamin d3", "vitamin d", "vit d", "25(oh)d", "25-oh-d",
    "25-oh vitamine d", "25 oh vitamine d", "vitamine d3", "vitamine d", "vit. d",
    "فيتامين د", "فيتامين دي",
  ],
  b12: ["vitamin b12", "vitamin b 12", "vit b12", "cobalamin", "b12", "vitamine b12", "vitamine b 12", "فيتامين ب12", "فيتامين ب ١٢", "فيتامين ب 12"],
  ferritin: ["ferritin", "ferritine", "الفيريتين", "مخزون الحديد"],
  hemoglobin: ["haemoglobin", "hemoglobin", "hgb", "hb", "hemoglobine", "الهيموغلوبين", "الهيموجلوبين", "خضاب الدم"],
  tsh: ["thyroid stimulating hormone", "tsh", "tsh ultrasensible", "tshus", "tsh us", "هرمون منبه الغده الدرقيه"],
  creatinine: ["creatinine", "creatininemie", "الكرياتينين"],
  alt: ["alanine aminotransferase", "alt (sgpt)", "sgpt", "alt", "alat", "tgp", "alat (tgp)", "انزيم الكبد alt"],
  uric_acid: ["uric acid", "acide urique", "uricemie", "حمض اليوريك", "حمض البوليك"],
};

// Lines about these aren't the test itself ("LDL/HDL ratio", urine tests,
// eGFR...): a missed value is safe, a mislabelled one is not.
const NOT_THE_TEST =
  /(^|[^a-z])(ratio|rapport|estimated average|eag|non[- ]hdl|vldl|urine|urines|urinary|urinaire|clearance|clairance|egfr|dfg|mean corpuscular|mch|mchc|bilirubin|bilirubine|free t4|ft4|ft3|t4 libre|t3 libre)([^a-z]|$)|البول|نسبه/;

const ARABIC = /[؀-ۿ]/;

// The form lines are matched in. Display always uses the original line.
export function fold(s: string) {
  return s
    .normalize("NFKC") // Arabic presentation forms (common in PDF text) -> plain letters
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // Persian digits
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/،/g, ",") // Arabic comma
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // French accents
    .replace(/[ً-ْـ]/g, "") // Arabic diacritics and tatweel
    .replace(/[آأإ]/g, "ا") // alif variants
    .replace(/ى/g, "ي") // alif maqsura -> ya
    .replace(/ة/g, "ه") // ta marbuta -> ha
    .toLowerCase()
    .replace(/μ/g, "µ") // NFKC turns the micro sign into Greek mu: units are written with the micro sign
    .replace(/\s+/g, " ")
    .trim();
}

// Unit as printed -> factor to the app's unit (value x factor), per test.
// Only fixed, standard factors; anything else is kept as printed and flagged.
type Conv = { unit: RegExp; factor?: number; convert?: (v: number) => number; label: string };
const UNITS: Record<string, Conv[]> = {
  hba1c: [
    { unit: /^%$/, factor: 1, label: "%" },
    // IFCC mmol/mol -> NGSP % (master equation)
    { unit: /^mmol\/mol$/, convert: (v) => 0.09148 * v + 2.152, label: "mmol/mol" },
  ],
  // French labs often print g/L (1,02 g/L = 102 mg/dL).
  glucose: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 18.016, label: "mmol/L" },
    { unit: /^g\/l$/, factor: 100, label: "g/L" },
  ],
  insulin: [
    { unit: /^(µ|u|m)iu\/ml$|^(µ|u|m)ui\/ml$|^uu\/ml$|^µu\/ml$|^mu\/l$|^mui\/l$/, factor: 1, label: "µIU/mL" },
    { unit: /^pmol\/l$/, factor: 1 / 6, label: "pmol/L" },
  ],
  cholesterol: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 38.67, label: "mmol/L" },
    { unit: /^g\/l$/, factor: 100, label: "g/L" },
  ],
  ldl: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 38.67, label: "mmol/L" },
    { unit: /^g\/l$/, factor: 100, label: "g/L" },
  ],
  hdl: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 38.67, label: "mmol/L" },
    { unit: /^g\/l$/, factor: 100, label: "g/L" },
  ],
  triglycerides: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^mmol\/l$/, factor: 88.57, label: "mmol/L" },
    { unit: /^g\/l$/, factor: 100, label: "g/L" },
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
  tsh: [{ unit: /^(µ|u|m)iu\/ml$|^(µ|u|m)ui\/ml$|^miu\/l$|^mui\/l$|^(µ|u)iu\/l$/, factor: 1, label: "mIU/L" }],
  creatinine: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^(µ|u)mol\/l$/, factor: 1 / 88.4, label: "µmol/L" },
    { unit: /^mg\/l$/, factor: 0.1, label: "mg/L" },
  ],
  alt: [{ unit: /^(u|iu|ui)\/l$/, factor: 1, label: "U/L" }],
  uric_acid: [
    { unit: /^mg\/dl$/, factor: 1, label: "mg/dL" },
    { unit: /^(µ|u)mol\/l$/, factor: 1 / 59.48, label: "µmol/L" },
    { unit: /^mg\/l$/, factor: 0.1, label: "mg/L" },
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
const UNIT_TOKEN = /(%|[µu]?[a-z]*\/[a-z]+)/;
const UNIT_TOKENS = /(%|[µu]?[a-z]*\/[a-z]+)/g;
const WORD = "a-z0-9\\u0600-\\u06ff";

function findAlias(f: string): { test: string; start: number; end: number; arabic: boolean } | null {
  let best: { test: string; start: number; end: number; len: number; arabic: boolean } | null = null;
  for (const [test, names] of Object.entries(ALIASES)) {
    for (const n of names) {
      const re = new RegExp(`(^|[^${WORD}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![${WORD}])`);
      const m = re.exec(f);
      if (!m) continue;
      const start = m.index + m[1].length;
      // The earliest name on the line wins; on a tie, the longest.
      if (!best || start < best.start || (start === best.start && n.length > best.len)) best = { test, start, end: start + n.length, len: n.length, arabic: ARABIC.test(n) };
    }
  }
  return best;
}

type Found = { raw: string; value: number; censored: boolean; unit: string };

// Numbers in a piece of a line, each marked when it belongs to a reference range ("4.0 - 5.6").
function numbersIn(s: string) {
  const out: { raw: string; at: number; end: number; inRange: boolean }[] = [];
  NUM.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUM.exec(s))) {
    const at = m.index + m[1].length;
    const end = at + m[2].length;
    const inRange = /^\s*[-–—~]\s*\d/.test(s.slice(end)) || /\d\s*[-–—~]\s*$/.test(s.slice(0, at));
    out.push({ raw: m[2].replace(/\s/g, ""), at, end, inRange });
  }
  return out;
}

const toFound = (raw: string, unit: string): Found | null => {
  const n = Number(raw.replace(/^[<>≤≥]/, "").replace(",", "."));
  return Number.isFinite(n) ? { raw, value: n, censored: /^[<>≤≥]/.test(raw), unit } : null;
};

// Left-to-right names: the result is the first number after the name, unless
// that number starts the reference range (then there's no clear result).
function valueAfter(rest: string): Found | null {
  // Bracketed name parts like "(25-OH)" or "(SGPT)" at the start aren't results.
  const cleaned = rest.replace(/^\s*[:\-]?\s*(\([^)]*\)\s*)*/, (m) => " ".repeat(m.length));
  const first = numbersIn(cleaned)[0];
  if (!first || first.inRange) return null;
  return toFound(first.raw, cleaned.slice(first.end).match(UNIT_TOKEN)?.[1] ?? "");
}

// Arabic (right-to-left) names: in the line as read left to right the result
// sits before the name, so it is the closest number before it that isn't part
// of the reference range. The unit is the one written next to it.
function valueBefore(before: string): Found | null {
  const nums = numbersIn(before).filter((n) => !n.inRange);
  const last = nums.at(-1);
  if (!last) return null;
  const between = before.slice(last.end);
  const left = before.slice(0, last.at);
  const unit = between.match(UNIT_TOKEN)?.[1] ?? [...left.matchAll(UNIT_TOKENS)].at(-1)?.[1] ?? "";
  return toFound(last.raw, unit);
}

export function readLabLines(lines: string[]): LabCandidate[] {
  const out: LabCandidate[] = [];
  const seen = new Set<string>();
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 3 || line.length > 220) continue;
    const f = fold(line);
    const hit = findAlias(f);
    if (!hit) continue;
    // Ratios, urine tests and the like are different measurements: skipped
    // (a missed value is safe, a mislabelled one is not).
    if (NOT_THE_TEST.test(f)) continue;
    const v = hit.arabic ? valueBefore(f.slice(0, hit.start)) : valueAfter(f.slice(hit.end));
    if (!v) continue;

    const def = labTest(hit.test);
    const unitText = v.unit;
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

// English and French month names (folded: no accents), by their first letters.
const MONTHS: Record<string, number> = {
  jan: 1, janv: 1, janvier: 1, feb: 2, fev: 2, fevr: 2, fevrier: 2, mar: 3, mars: 3, apr: 4, avr: 4, avril: 4, may: 5, mai: 5,
  jun: 6, juin: 6, jul: 7, juil: 7, juillet: 7, aug: 8, aou: 8, aout: 8, sep: 9, sept: 9, septembre: 9, oct: 10, octobre: 10,
  nov: 11, novembre: 11, dec: 12, decembre: 12,
};

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
  for (const m of line.matchAll(/\b(\d{1,2})(?:er)?[\s-]([a-z]{3,9})\.?[\s-,]+(\d{4})\b/gi)) {
    const word = m[2].toLowerCase();
    const mon = MONTHS[word] ?? MONTHS[word.slice(0, 4)] ?? MONTHS[word.slice(0, 3)];
    const iso = mon ? toIso(+m[3], mon, +m[1]) : null;
    if (iso) out.push({ iso, at: m.index ?? 0 });
  }
  return out;
}

// The sample/report date. Each date is judged by the label just before it:
// collection dates first, then report dates; birth dates never count.
export function reportDate(lines: string[], today: string): string | null {
  const scored: { iso: string; score: number }[] = [];
  for (const raw of lines) {
    const line = fold(raw);
    for (const { iso, at } of datesIn(line)) {
      if (iso > today) continue;
      // Arabic labels may sit after the date (right to left), so look on both sides for those.
      const label = line.slice(Math.max(0, at - 28), at);
      const around = label + " " + line.slice(at, at + 40);
      if (/(birth|dob|born|d\.o\.b|naissance|ne le|nee le|ne\(e\) le)/.test(label) || /(الولاده|الميلاد)/.test(around)) continue;
      const score = /(collect|sampl|drawn|specimen|prelev|recueil)/.test(label) || /(سحب|العينه)/.test(around)
        ? 3
        : /(report|result|received|registered|date|edit|imprim|valid)/.test(label) || /تاريخ/.test(around)
          ? 2
          : 1;
      scored.push({ iso, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || b.iso.localeCompare(a.iso));
  return scored[0]?.iso ?? null;
}

// Whether the patient's name is in the document: "match" when every part of it
// is (Latin or Arabic script, accents ignored). A name written in the other
// script counts as missing, so the dietitian is asked to confirm.
export function nameCheck(text: string, fullName: string): "match" | "partial" | "missing" {
  const doc = fold(text);
  const parts = fold(fullName)
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z؀-ۿ]/g, ""))
    .filter((p) => p.length >= 3);
  if (!parts.length) return "missing";
  const found = parts.filter((p) => new RegExp(`(^|[^${WORD}])${p}([^${WORD}]|$)`).test(doc)).length;
  return found === parts.length ? "match" : found > 0 ? "partial" : "missing";
}
