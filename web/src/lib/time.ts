// Client-safe date/time helpers in the practice's timezone. Appointments are
// stored as instants (UTC); people type and read local times.

// Offset of `timeZone` from UTC, in minutes, at the given instant.
function offsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

// "2026-12-01" + "09:30" in Asia/Beirut -> ISO instant.
export function localToIso(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle the hour around daylight-saving changes.
  let t = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  t = guess - offsetMinutes(new Date(t), timeZone) * 60000;
  return new Date(t).toISOString();
}

// ISO instant -> { date: "2026-12-01", time: "09:30", minutes: 570 } in the timezone.
export function isoToLocal(iso: string, timeZone: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const [hh, mm] = time.split(":").map(Number);
  return { date, time, minutes: hh * 60 + mm };
}

export function formatWhen(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
}

export function formatTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday of the week containing `date`.
export function weekStart(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

export function dayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export const APPOINTMENT_STATUS = {
  requested: { label: "Requested", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "blue" },
  completed: { label: "Attended", tone: "green" },
  no_show: { label: "No-show", tone: "red" },
  cancelled: { label: "Cancelled", tone: "gray" },
} as const;

export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS;
