import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { MacroSummary } from "@/components/macro-summary";
import { Card } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { round, SLOT_LABELS, sumMacros, type MealSlot } from "@/lib/nutrition";
import { activePlan } from "@/lib/patient-plan";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayLabel } from "@/lib/time";
import { deleteEntry } from "../actions";
import { DiaryAdd } from "../widgets";

export const metadata: Metadata = { title: "Diary" };

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export default async function DiaryPage({ searchParams }: PageProps<"/patient/diary">) {
  const { link } = await requirePatient();
  const { d } = await searchParams;
  const today = todayIn(link.timezone);
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && d >= addDays(today, -30) ? d : today;
  const [plan, { data: entries }] = await Promise.all([
    activePlan(link.patientId),
    (await createClient()).from("diary_entries").select("*").eq("patient_id", link.patientId).eq("eaten_on", date).order("created_at"),
  ]);
  const totals = sumMacros((entries ?? []).map((e) => ({ kcal: Number(e.kcal), protein_g: Number(e.protein_g), carbs_g: Number(e.carbs_g), fat_g: Number(e.fat_g), fiber_g: Number(e.fiber_g ?? 0) })));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: link.timezone }).format(new Date()));
  const defaultSlot: MealSlot = hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 21 ? "dinner" : "snack";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/patient/diary?d=${addDays(date, -1)}`} aria-label="Previous day" className="grid size-10 place-items-center rounded-full hover:bg-surface">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-semibold">{date === today ? "Today" : dayLabel(date)}</h1>
        {date < today ? (
          <Link href={`/patient/diary?d=${addDays(date, 1)}`} aria-label="Next day" className="grid size-10 place-items-center rounded-full hover:bg-surface">
            <ChevronRight className="size-5" />
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </div>

      <Card className="rounded-2xl p-5">
        <MacroSummary totals={totals} targets={plan?.targets} compact neutral />
      </Card>

      <DiaryAdd date={date} defaultSlot={date === today ? defaultSlot : "lunch"} />

      {SLOTS.map((slot) => {
        const items = (entries ?? []).filter((e) => e.slot === slot);
        return (
          <Card key={slot} className="rounded-2xl">
            <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
              <h2 className="font-semibold">{SLOT_LABELS[slot]}</h2>
              <span className="text-sm text-muted tabular-nums">{round(items.reduce((a, e) => a + Number(e.kcal), 0))} kcal</span>
            </div>
            {items.length ? (
              <ul className="divide-y divide-line px-5 pb-2">
                {items.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{e.name}</span>
                      <span className="block text-xs text-muted tabular-nums">
                        {round(Number(e.grams))} g · {round(Number(e.kcal))} kcal
                      </span>
                    </span>
                    <ActionButton action={deleteEntry.bind(null, e.id)} variant="ghost" className="h-8 px-2" confirm={`Remove ${e.name}?`} danger>
                      <X className="size-4" aria-label="Remove" />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-4 text-sm text-muted">Nothing logged.</p>
            )}
          </Card>
        );
      })}
      <p className="text-center text-xs text-muted">Nutrition comes from the food database. Planned meals can be logged in one tap from Today.</p>
    </div>
  );
}
