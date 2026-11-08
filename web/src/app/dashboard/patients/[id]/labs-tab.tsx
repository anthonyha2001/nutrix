import { FlaskConical, Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { RowMenu } from "@/components/row-menu";
import { TrendChart } from "@/components/trend-chart";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDate, num } from "@/lib/format";
import { labFlag, labLabel, labTest, LAB_TESTS } from "@/lib/labs";
import { createClient } from "@/lib/supabase/server";
import { addLabResult, deleteLabResult } from "../actions";
import { LabForm } from "../forms";

// Lab results grouped by test: latest value against the typical range, the
// trend, and the history.
export async function LabsTab({ patientId, today }: { patientId: string; today: string }) {
  const supabase = await createClient();
  const { data: results } = await supabase.from("lab_results").select("*").eq("patient_id", patientId).order("measured_on", { ascending: false }).order("created_at", { ascending: false });

  const byTest = new Map<string, NonNullable<typeof results>>();
  for (const r of results ?? []) byTest.set(r.test, [...(byTest.get(r.test) ?? []), r]);
  // Known tests in the usual order, then the others by name.
  const order = (id: string) => {
    const i = LAB_TESTS.findIndex((t) => t.id === id);
    return i === -1 ? 1000 : i;
  };
  const tests = [...byTest.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Typical adult ranges flag values to look at. Each lab has its own ranges.</p>
        <Dialog label="Add result" icon={<Plus className="size-4" />} title="Add lab result">
          <LabForm action={addLabResult.bind(null, patientId)} today={today} />
        </Dialog>
      </div>
      {!tests.length ? (
        <Card className="mt-4">
          <EmptyState>
            <span className="flex flex-col items-center gap-2 pt-5">
              <FlaskConical className="size-5 text-muted" />
              No lab results yet. Add HbA1c, cholesterol, vitamin D and others to follow them over time.
            </span>
          </EmptyState>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {tests.map((id) => {
            const rows = byTest.get(id)!;
            const latest = rows[0];
            const flag = labFlag(id, Number(latest.value), latest.unit);
            const sameUnit = rows.filter((r) => r.unit === latest.unit);
            return (
              <Card key={id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{labLabel(id)}</p>
                    {labTest(id) && <p className="text-xs text-muted">Typical {labTest(id)!.range}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">
                      {num(Number(latest.value), 2)} <span className="text-sm font-normal text-muted">{latest.unit}</span>
                    </p>
                    <p className="text-xs text-muted">{formatDate(latest.measured_on)}</p>
                  </div>
                </div>
                {flag && (
                  <div className="mt-2">
                    <Badge tone={flag === "high" ? "red" : "amber"}>{flag === "high" ? "Above the typical range" : "Below the typical range"}</Badge>
                  </div>
                )}
                {sameUnit.length > 1 && (
                  <div className="mt-3">
                    <TrendChart title="Trend" unit={latest.unit} points={sameUnit.map((r) => ({ date: r.measured_on, value: Number(r.value) }))} />
                  </div>
                )}
                <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-2">
                      <span className="w-28 shrink-0 text-muted">{formatDate(r.measured_on)}</span>
                      <span className="min-w-0 flex-1 tabular-nums">
                        {num(Number(r.value), 2)} {r.unit}
                        {r.note && <span className="block truncate text-xs text-muted">{r.note}</span>}
                      </span>
                      <RowMenu items={[{ kind: "action", label: "Delete", danger: true, action: deleteLabResult.bind(null, r.id), confirm: `Delete this ${labLabel(id)} result?` }]} />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
