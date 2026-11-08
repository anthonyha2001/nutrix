// Client-safe formatting helpers.

// Date-only strings ("2026-11-08") are calendar dates: format them in UTC so
// they never shift a day in the viewer's timezone.
export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(value.length === 10 ? { timeZone: "UTC" } : {}),
  });
}

export function shortDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// Today's date (YYYY-MM-DD) in the practice's timezone.
export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function ageOn(dateOfBirth: string | null, today: string) {
  if (!dateOfBirth) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

export function num(value: number | string | null | undefined, digits = 0) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
