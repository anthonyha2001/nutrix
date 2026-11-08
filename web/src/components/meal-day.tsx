import { Repeat } from "lucide-react";
import { Card } from "@/components/ui";
import { amountLabel, round, SLOT_LABELS, type SavedDay } from "@/lib/nutrition";

// One day of a saved plan, read-only (patient app).
export function MealDay({ day }: { day: SavedDay }) {
  return (
    <div className="space-y-3">
      {day.meals.map((meal) => (
        <Card key={meal.key} className="rounded-2xl">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
            <h3 className="font-semibold">
              {meal.name || SLOT_LABELS[meal.slot]}
              {meal.name && <span className="ml-2 text-sm font-normal text-muted">{SLOT_LABELS[meal.slot]}</span>}
            </h3>
            <span className="text-sm text-muted tabular-nums">
              {meal.time ? `${meal.time} · ` : ""}
              {round(meal.totals.kcal)} kcal
            </span>
          </div>
          <ul className="divide-y divide-line px-5 pb-2">
            {meal.items.map((item, i) => (
              <li key={`${item.food_id}-${i}`} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm">{item.name}</span>
                  <span className="shrink-0 text-right text-sm text-muted tabular-nums">{amountLabel(item)}</span>
                </div>
                {item.alternatives && item.alternatives.length > 0 && (
                  <p className="mt-1 flex gap-1.5 text-xs text-muted">
                    <Repeat className="mt-0.5 size-3 shrink-0" />
                    <span>Or: {item.alternatives.map((a) => `${a.name} (${amountLabel(a)})`).join("; ")}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
          {meal.notes && <p className="px-5 pb-4 text-sm text-muted">{meal.notes}</p>}
        </Card>
      ))}
    </div>
  );
}
