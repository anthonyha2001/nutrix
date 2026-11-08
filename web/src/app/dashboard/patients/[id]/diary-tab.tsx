import { Card, EmptyState } from "@/components/ui";
import { num, todayIn } from "@/lib/format";
import { round, SLOT_LABELS, type MealSlot, type Targets } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayLabel } from "@/lib/time";

const MOOD = ["", "Very low", "Low", "OK", "Good", "Great"];

// The patient's last 14 days: what they logged, water, and how they felt.
export async function DiaryTab({ patientId, timeZone, targets }: { patientId: string; timeZone: string; targets?: Targets }) {
  const supabase = await createClient();
  const today = todayIn(timeZone);
  const from = addDays(today, -13);
  const [{ data: entries }, { data: checkins }] = await Promise.all([
    supabase.from("diary_entries").select("*").eq("patient_id", patientId).gte("eaten_on", from).order("created_at"),
    supabase.from("daily_checkins").select("*").eq("patient_id", patientId).gte("day", from),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const byDay = (d: string) => (entries ?? []).filter((e) => e.eaten_on === d);
  const check = (d: string) => checkins?.find((c) => c.day === d);
  const logged = days.filter((d) => byDay(d).length).length;

  if (!entries?.length && !checkins?.length) {
    return (
      <Card>
        <EmptyState>
          <span className="block pt-5">Nothing logged in the last 14 days. The patient logs meals, water and check-ins from their app.</span>
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <p className="text-sm text-muted">
        Logged {logged} of the last 14 days{targets?.kcal ? ` · target ${targets.kcal} kcal` : ""}.
      </p>
      <div className="mt-3 space-y-2">
        {days.map((d) => {
          const list = byDay(d);
          const c = check(d);
          if (!list.length && !c) return null;
          const t = list.reduce((a, e) => ({ kcal: a.kcal + Number(e.kcal), p: a.p + Number(e.protein_g), cb: a.cb + Number(e.carbs_g), f: a.f + Number(e.fat_g) }), { kcal: 0, p: 0, cb: 0, f: 0 });
          return (
            <details key={d} className="group rounded-xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-28 font-medium">{d === today ? "Today" : dayLabel(d)}</span>
                <span className="tabular-nums">
                  {list.length ? (
                    <>
                      <span className="font-semibold">{round(t.kcal)} kcal</span>
                      <span className="text-muted">
                        {" "}
                        · P {round(t.p)} · C {round(t.cb)} · F {round(t.f)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">No meals logged</span>
                  )}
                </span>
                <span className="ml-auto flex gap-3 text-xs text-muted">
                  {c?.water_ml ? <span>Water {num(c.water_ml / 1000, 1)} L</span> : null}
                  {c?.mood ? <span>Mood: {MOOD[c.mood]}</span> : null}
                  {c?.followed_plan ? <span>Plan {c.followed_plan}/5</span> : null}
                </span>
              </summary>
              <div className="border-t border-line px-5 py-3 text-sm">
                {(["breakfast", "lunch", "dinner", "snack"] as MealSlot[]).map((slot) => {
                  const items = list.filter((e) => e.slot === slot);
                  if (!items.length) return null;
                  return (
                    <div key={slot} className="py-1.5">
                      <p className="text-xs font-medium text-muted">{SLOT_LABELS[slot]}</p>
                      {items.map((e) => (
                        <p key={e.id} className="flex justify-between gap-3">
                          <span>
                            {e.name}
                            {e.source !== "search" && <span className="ml-1.5 text-xs text-brand-strong">{e.source === "plan" ? "from plan" : "swap"}</span>}
                          </span>
                          <span className="shrink-0 text-muted tabular-nums">
                            {round(Number(e.grams))} g · {round(Number(e.kcal))} kcal
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                })}
                {c && (c.energy || c.hunger || c.sleep_hours || c.note) && (
                  <p className="mt-2 border-t border-line pt-2 text-muted">
                    {[c.energy ? `Energy ${c.energy}/5` : null, c.hunger ? `Hunger ${c.hunger}/5` : null, c.sleep_hours ? `Slept ${c.sleep_hours} h` : null].filter(Boolean).join(" · ")}
                    {c.note ? ` · "${c.note}"` : ""}
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
