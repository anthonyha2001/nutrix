// Reads body composition results from a device export (InBody / LookinBody,
// Tanita and similar CSV or Excel files), without AI. Columns are matched by
// the names those exports use; a value is only ever copied from its cell or,
// when marked "calculated", derived with a stated formula. The dietitian
// reviews and approves every row before it is saved.

export type BodyField = "weight_kg" | "body_fat_pct" | "muscle_mass_kg" | "body_water_pct" | "visceral_fat" | "bmr_kcal" | "waist_cm" | "hip_cm";

export const BODY_FIELDS: { id: BodyField; label: string; unit: string; min: number; max: number }[] = [
  { id: "weight_kg", label: "Weight", unit: "kg", min: 1, max: 400 },
  { id: "body_fat_pct", label: "Body fat", unit: "%", min: 1, max: 80 },
  { id: "muscle_mass_kg", label: "Muscle mass", unit: "kg", min: 1, max: 200 },
  { id: "body_water_pct", label: "Body water", unit: "%", min: 10, max: 90 },
  { id: "visceral_fat", label: "Visceral fat", unit: "", min: 0, max: 60 },
  { id: "bmr_kcal", label: "BMR", unit: "kcal", min: 300, max: 6000 },
  { id: "waist_cm", label: "Waist", unit: "cm", min: 20, max: 300 },
  { id: "hip_cm", label: "Hip", unit: "cm", min: 20, max: 300 },
];

export type BodyRow = {
  date: string | null;
  name: string | null;
  values: Partial<Record<BodyField, number>>;
  calculated: BodyField[];
  warnings: string[];
  confident: boolean;
};

export type BodyFile = { device: "inbody" | "tanita" | "manual"; rows: BodyRow[]; unmatched: string[]; error?: string };

// Header text (lowercase, units removed) -> what it holds.
type Col = BodyField | "fat_mass_kg" | "water_l" | "date" | "time" | "name" | "id" | "height_cm" | "skip";
// English and French (accents removed) column names.
const HEADERS: [RegExp, Col][] = [
  [/^(test )?date( ?\/ ?time)?$|^date of test$|^measurement date$|^datetime$|^test date ?time$|^date (du test|de mesure|de la mesure|et heure)$/, "date"],
  [/^time$|^test time$|^heure$/, "time"],
  [/^(name|client|client name|member name|patient|full name|nom|nom du client|nom et prenom)$/, "name"],
  [/^(id|client id|member id|user id|identifiant)$/, "id"],
  [/^(height|taille|hauteur)$/, "height_cm"],
  [/^(body )?weight$|^wt$|^poids( corporel)?$/, "weight_kg"],
  [/^(pbf|percent body fat|body fat percentage|body fat ?%|fat ?%|body fat \(%\)|% ?body fat|bf%|fat percentage|pourcentage de graisse( corporelle)?|% ?graisse( corporelle)?|graisse corporelle ?%|masse grasse ?%|mg ?%)$/, "body_fat_pct"],
  [/^(bfm|body fat mass|fat mass|masse grasse|masse de graisse corporelle)$/, "fat_mass_kg"],
  [/^(smm|skeletal muscle mass|muscle mass|predicted muscle mass|masse musculaire squelettique|masse musculaire|mms)$/, "muscle_mass_kg"],
  [/^(tbw ?%|total body water ?%|body water ?%|water ?%|tbw percentage|body water percentage|eau corporelle( totale)? ?%|% ?eau( corporelle)?)$/, "body_water_pct"],
  [/^(tbw|total body water|body water|eau corporelle totale|eau corporelle|ect)$/, "water_l"],
  [/^(visceral fat( level| rating)?|vfl|vfa|visceral fat area|(niveau de )?graisse viscerale|indice de graisse viscerale)$/, "visceral_fat"],
  [/^(bmr|basal metabolic rate|metabolisme de base|mb)$/, "bmr_kcal"],
  [/^(waist|waist circumference|tour de taille)$/, "waist_cm"],
  [/^(hip|hip circumference|tour de hanches?)$/, "hip_cm"],
];

const deaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// "Weight (kg)" -> { text: "weight", unit: "kg" }; "Poids (kg)" -> { text: "poids", unit: "kg" }
function header(h: string) {
  const unit = (h.match(/\(([^)]*)\)|\[([^\]]*)\]/)?.slice(1).find(Boolean) ?? "").trim().toLowerCase();
  const text = deaccent(h.toLowerCase()).replace(/\([^)]*\)|\[[^\]]*\]/g, (m) => (m.includes("%") ? "%" : "")).replace(/[_\s]+/g, " ").trim();
  return { text, unit };
}

// Small CSV reader: quotes, and comma, semicolon or tab separators (as Excel writes them).
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const num = (s: string | undefined) => {
  if (s === undefined) return null;
  const t = s.trim().replace(/\s/g, "");
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return null;
  return Number(t.replace(",", "."));
};

function isoDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return a > 12 || b <= 12 ? valid(y, b, a) : valid(y, a, b);
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})/); // LookinBody "20261103101500"
  if (m) return valid(+m[1], +m[2], +m[3]);
  return null;
}
const valid = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const sameName = (a: string, b: string) => {
  const pa = fold(a).split(" ").filter((p) => p.length >= 3), pb = new Set(fold(b).split(" "));
  return pa.length > 0 && pa.every((p) => pb.has(p));
};

// ---- Printed result sheets (an InBody/Tanita sheet as PDF, or a transcribed photo)

// English and French (accents removed); lines are matched without accents.
const LINE_FIELDS: [RegExp, BodyField | "fat_mass_kg" | "water_l"][] = [
  [/\b(percent body fat|pbf|body fat percentage|body fat ?%|fat ?%|pourcentage de graisse( corporelle)?|taux de graisse)\b/i, "body_fat_pct"],
  [/\b(body fat mass|fat mass|bfm|masse grasse)\b/i, "fat_mass_kg"],
  [/\b(skeletal muscle mass|smm|muscle mass|masse musculaire( squelettique)?)\b/i, "muscle_mass_kg"],
  [/\b(total body water|tbw|body water|eau corporelle( totale)?)\b/i, "water_l"],
  [/\b(visceral fat( level| rating)?|vfl|(niveau de )?graisse viscerale)\b/i, "visceral_fat"],
  [/\b(basal metabolic rate|bmr|metabolisme de base)\b/i, "bmr_kcal"],
  [/\b(waist circumference|tour de taille)\b/i, "waist_cm"],
  [/\b(hip circumference|tour de hanches?)\b/i, "hip_cm"],
  [/\b(body weight|weight|poids)\b/i, "weight_kg"],
];
// Lines about targets, history or one limb are not today's whole-body result.
const NOT_RESULT =
  /\b(target|control|ideal|recommended|history|normal|standard|segmental|right|left|arm|leg|trunk|change|goal|range|objectif|controle|recommande|historique|segmentaire|droit|droite|gauche|bras|jambe|tronc|evolution|plage)\b/i;

export function readBodyLines(lines: string[], patientName: string, docName: string | null, date: string | null, today: string): BodyFile {
  const values: Partial<Record<BodyField, number>> = {};
  const sources: Partial<Record<BodyField, string>> = {};
  const warnings: string[] = [];
  let fatMass: number | null = null, waterL: number | null = null, waterPct = false;
  for (const raw of lines) {
    // Matched without accents ("Métabolisme de base"); French decimal commas are handled below.
    const line = deaccent(raw).replace(/\s+/g, " ").trim();
    if (!line || line.length > 160 || NOT_RESULT.test(line)) continue;
    const hit = LINE_FIELDS.find(([re]) => re.test(line));
    if (!hit) continue;
    const after = line.slice((line.match(hit[0])?.index ?? 0) + (line.match(hit[0])?.[0].length ?? 0));
    const m = after.match(/(^|[^\d.])(\d+(?:[.,]\d+)?)(?![\d.])(\s*(kg|lb|lbs|%|l|kcal|cm))?/i);
    if (!m || /^\s*[-–~]\s*\d/.test(after.slice((m.index ?? 0) + m[0].length))) continue;
    let v = Number(m[2].replace(",", "."));
    const unit = (m[4] ?? "").toLowerCase();
    const field = hit[1];
    if ((unit === "lb" || unit === "lbs") && (field === "weight_kg" || field === "muscle_mass_kg" || field === "fat_mass_kg")) {
      v = Math.round(v * 0.45359237 * 10) / 10;
      warnings.push(`${line}: converted from pounds.`);
    }
    if (field === "fat_mass_kg") { if (fatMass === null) fatMass = v; continue; }
    if (field === "water_l") {
      if (unit === "%") { if (values.body_water_pct === undefined) { values.body_water_pct = v; waterPct = true; } }
      else if (waterL === null) waterL = v;
      continue;
    }
    if (values[field] === undefined) {
      values[field] = v;
      sources[field] = line;
    }
  }
  if (!Object.keys(values).length && fatMass === null) {
    return { device: "manual", rows: [], unmatched: [], error: "No body composition results found in this document." };
  }
  const row = finishRow(values, fatMass, waterPct ? null : waterL, date, docName, patientName, today, warnings);
  return { device: "manual", rows: [row], unmatched: [] };
}

function finishRow(
  values: Partial<Record<BodyField, number>>,
  fatMass: number | null,
  waterL: number | null,
  date: string | null,
  name: string | null,
  patientName: string,
  today: string,
  warnings: string[],
): BodyRow {
  const calculated: BodyField[] = [];
  const w = values.weight_kg;
  // Derived values, shown as calculated: fat % from fat mass, water % from litres (1 L of water = 1 kg).
  if (values.body_fat_pct === undefined && fatMass !== null && w) {
    values.body_fat_pct = Math.round((fatMass / w) * 1000) / 10;
    calculated.push("body_fat_pct");
  } else if (values.body_fat_pct !== undefined && fatMass !== null && w && Math.abs((fatMass / w) * 100 - values.body_fat_pct) > 2) {
    warnings.push(`Body fat ${values.body_fat_pct}% doesn't match fat mass ${fatMass} kg of ${w} kg (${Math.round((fatMass / w) * 1000) / 10}%).`);
  }
  if (values.body_water_pct === undefined && waterL !== null && w) {
    values.body_water_pct = Math.round((waterL / w) * 1000) / 10;
    calculated.push("body_water_pct");
  }
  for (const f of BODY_FIELDS) {
    const v = values[f.id];
    if (v !== undefined && (v < f.min || v > f.max)) warnings.push(`${f.label} ${v} ${f.unit} is outside the possible range.`);
  }
  if (!date) warnings.push("No test date found: set the date.");
  else if (date > today) warnings.push("The test date is in the future.");
  if (name && !sameName(patientName, name)) warnings.push(`This is for "${name}", not ${patientName}.`);
  return { date, name, values, calculated, warnings, confident: warnings.length === 0 };
}

export function readBodyComp(table: string[][], patientName: string, today: string): BodyFile {
  // The header is the first row with at least two recognised columns (exports may start with titles).
  let headerAt = -1;
  let cols: { col: Col; unit: string; raw: string }[] = [];
  for (let r = 0; r < Math.min(table.length, 15); r++) {
    const mapped = table[r].map((h) => {
      const { text, unit } = header(h);
      // "PBF (%)" reads as "pbf %": try it with and without the percent sign.
      const bare = text.replace(/\s*%$/, "");
      const col = HEADERS.find(([re]) => re.test(text))?.[1] ?? (bare !== text || unit === "%" ? HEADERS.find(([re]) => re.test(bare))?.[1] : undefined) ?? "skip";
      return { col: col as Col, unit, raw: h.trim() };
    });
    if (mapped.filter((m) => m.col !== "skip").length >= 2) {
      headerAt = r;
      cols = mapped;
      break;
    }
  }
  if (headerAt < 0) return { device: "manual", rows: [], unmatched: [], error: "No body composition columns found. Export the results as CSV or Excel from the device software." };

  const headerText = cols.map((c) => c.raw.toLowerCase()).join(" ");
  const device = /\b(pbf|smm|bfm|inbody|lookin)\b/.test(headerText) ? "inbody" : /\b(tanita|visceral fat rating|metabolic age)\b/.test(headerText) ? "tanita" : "manual";
  const unmatched = cols.filter((c) => c.col === "skip" && c.raw).map((c) => c.raw);
  const rows: BodyRow[] = [];

  for (const cells of table.slice(headerAt + 1)) {
    const values: Partial<Record<BodyField, number>> = {};
    const warnings: string[] = [];
    let date: string | null = null, name: string | null = null, fatMass: number | null = null, waterL: number | null = null;

    cols.forEach((c, i) => {
      const cell = cells[i] ?? "";
      if (c.col === "date") date = isoDate(cell);
      else if (c.col === "name") name = cell.trim() || null;
      else if (c.col === "skip" || c.col === "time" || c.col === "id" || c.col === "height_cm") return;
      else {
        let v = num(cell);
        if (v === null) return;
        const lb = c.unit === "lb" || c.unit === "lbs";
        if (lb && (c.col === "weight_kg" || c.col === "muscle_mass_kg" || c.col === "fat_mass_kg")) {
          v = Math.round(v * 0.45359237 * 10) / 10;
          warnings.push(`${c.raw} converted from pounds.`);
        }
        if (c.col === "fat_mass_kg") fatMass = v;
        else if (c.col === "water_l") waterL = v;
        else values[c.col] = v;
      }
    });
    if (!Object.keys(values).length && fatMass === null) continue;

    rows.push(finishRow(values, fatMass, waterL, date, name, patientName, today, warnings));
  }
  return { device, rows, unmatched };
}
