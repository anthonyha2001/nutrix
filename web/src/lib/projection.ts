// When a patient may reach their target weight at the current pace. Client-safe.
//
// Pace is the least-squares slope of the weigh-ins over the last 8 weeks
// (needing at least two readings a week or more apart), so one heavy morning
// doesn't swing it. An estimate to motivate, not a promise.

export type Projection =
  | { status: "reached" }
  | { status: "needs_data" }
  | { status: "stalled"; weeklyKg: number }
  | { status: "on_track"; weeklyKg: number; weeks: number; remainingKg: number };

const DAY = 86_400_000;

export function projectGoal(weights: { date: string; kg: number }[], targetKg: number | null): Projection | null {
  if (!targetKg) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest) return { status: "needs_data" };
  const remaining = targetKg - latest.kg;
  if (Math.abs(remaining) < 0.5) return { status: "reached" };

  const end = Date.parse(`${latest.date}T00:00:00Z`);
  const recent = sorted.filter((w) => end - Date.parse(`${w.date}T00:00:00Z`) <= 56 * DAY);
  const spanDays = recent.length > 1 ? (end - Date.parse(`${recent[0].date}T00:00:00Z`)) / DAY : 0;
  if (recent.length < 2 || spanDays < 7) return { status: "needs_data" };

  const xs = recent.map((w) => (Date.parse(`${w.date}T00:00:00Z`) - end) / DAY);
  const ys = recent.map((w) => w.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slopePerDay = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const weeklyKg = Math.round(slopePerDay * 7 * 10) / 10;

  // Moving the wrong way, or too slowly to project (under 0.1 kg a week).
  if (Math.sign(slopePerDay) !== Math.sign(remaining) || Math.abs(weeklyKg) < 0.1) return { status: "stalled", weeklyKg };
  const weeks = Math.ceil(remaining / (slopePerDay * 7));
  return { status: "on_track", weeklyKg, weeks, remainingKg: Math.round(remaining * 10) / 10 };
}

export function projectionText(p: Projection | null, targetKg: number | null): string | null {
  if (!p || !targetKg) return null;
  switch (p.status) {
    case "reached":
      return "Target reached";
    case "needs_data":
      return "Two weigh-ins a week apart give a projection";
    case "stalled":
      return p.weeklyKg === 0 ? "Weight is stable, not moving toward the target yet" : `${p.weeklyKg > 0 ? "+" : ""}${p.weeklyKg} kg a week, away from the target`;
    case "on_track":
      return `${Math.abs(p.remainingKg)} kg to go · about ${p.weeks} week${p.weeks === 1 ? "" : "s"} at ${p.weeklyKg > 0 ? "+" : ""}${p.weeklyKg} kg a week`;
  }
}
