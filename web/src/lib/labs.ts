// Lab tests dietitians follow most, with typical adult reference ranges. Labs
// use their own ranges and units, so these flag values for a closer look; they
// don't diagnose. Client-safe.

export type LabTest = { id: string; label: string; unit: string; low?: number; high?: number; range: string };

export const LAB_TESTS: LabTest[] = [
  { id: "hba1c", label: "HbA1c", unit: "%", high: 5.6, range: "below 5.7% (5.7 to 6.4 prediabetes, 6.5 and over diabetes)" },
  { id: "glucose", label: "Fasting glucose", unit: "mg/dL", low: 70, high: 99, range: "70 to 99 mg/dL" },
  { id: "insulin", label: "Fasting insulin", unit: "µIU/mL", low: 2, high: 25, range: "2 to 25 µIU/mL" },
  { id: "cholesterol", label: "Total cholesterol", unit: "mg/dL", high: 199, range: "below 200 mg/dL" },
  { id: "ldl", label: "LDL cholesterol", unit: "mg/dL", high: 129, range: "below 130 mg/dL (lower targets for heart risk)" },
  { id: "hdl", label: "HDL cholesterol", unit: "mg/dL", low: 40, range: "40 mg/dL or more (50 or more for women)" },
  { id: "triglycerides", label: "Triglycerides", unit: "mg/dL", high: 149, range: "below 150 mg/dL" },
  { id: "vitamin_d", label: "Vitamin D (25-OH)", unit: "ng/mL", low: 30, high: 100, range: "30 to 100 ng/mL" },
  { id: "b12", label: "Vitamin B12", unit: "pg/mL", low: 200, high: 900, range: "200 to 900 pg/mL" },
  { id: "ferritin", label: "Ferritin", unit: "ng/mL", low: 15, high: 300, range: "15 to 300 ng/mL (lower in women)" },
  { id: "hemoglobin", label: "Haemoglobin", unit: "g/dL", low: 12, high: 17.5, range: "12 to 17.5 g/dL" },
  { id: "tsh", label: "TSH", unit: "mIU/L", low: 0.4, high: 4, range: "0.4 to 4.0 mIU/L" },
  { id: "creatinine", label: "Creatinine", unit: "mg/dL", low: 0.6, high: 1.3, range: "0.6 to 1.3 mg/dL" },
  { id: "alt", label: "ALT", unit: "U/L", high: 55, range: "below 56 U/L" },
  { id: "uric_acid", label: "Uric acid", unit: "mg/dL", low: 3.5, high: 7.2, range: "3.5 to 7.2 mg/dL" },
];

const BY_ID = new Map(LAB_TESTS.map((t) => [t.id, t]));

export function labTest(id: string) {
  return BY_ID.get(id);
}

export function labLabel(id: string) {
  return BY_ID.get(id)?.label ?? id;
}

// "high" / "low" against the typical range, when the unit is the one it's for.
export function labFlag(id: string, value: number, unit: string): "high" | "low" | null {
  const t = BY_ID.get(id);
  if (!t || t.unit !== unit) return null;
  if (t.high !== undefined && value > t.high) return "high";
  if (t.low !== undefined && value < t.low) return "low";
  return null;
}
