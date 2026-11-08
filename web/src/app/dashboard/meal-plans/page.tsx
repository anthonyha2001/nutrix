import type { Metadata } from "next";
import Link from "next/link";
import { PageTabs } from "@/components/page-tabs";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { SavedContent } from "@/lib/nutrition";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meal plans" };

const STATUSES = ["active", "draft", "archived"] as const;
const LABELS = { active: "Active", draft: "Drafts", archived: "Previous" } as const;
const TONES = { active: "green", draft: "amber", archived: "gray" } as const;

// Plans across all your patients. Building and editing happen in the patient's file.
export default async function MealPlansPage({ searchParams }: PageProps<"/dashboard/meal-plans">) {
  await requireStaff(CLINICAL_ROLES);
  const { tab } = await searchParams;
  const status = STATUSES.includes(tab as (typeof STATUSES)[number]) ? (tab as (typeof STATUSES)[number]) : "active";

  const supabase = await createClient();
  const [{ data: plans }, counts] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id, name, status, starts_on, ends_on, updated_at, content->totals, patient_id, patients(full_name, archived_at)")
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(300),
    Promise.all(STATUSES.map((s) => supabase.from("meal_plans").select("*", { count: "exact", head: true }).eq("status", s).then((r) => r.count ?? 0))),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Meal plans" description="Plans across your patients. Open a plan to edit it in the patient's file." />
      <PageTabs base="/dashboard/meal-plans" active={status} tabs={STATUSES.map((s, i) => ({ id: s, label: LABELS[s], count: s === "archived" ? undefined : counts[i] }))} />
      <Card>
        {!plans?.length ? (
          <EmptyState>
            <span className="block pt-5">
              {status === "active" ? "No active plans. Build a plan from a patient's file." : status === "draft" ? "No drafts." : "No previous plans yet."}
            </span>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {plans.map((p) => {
              const totals = p.totals as SavedContent["totals"] | null;
              return (
                <li key={p.id}>
                  <Link href={`/dashboard/patients/${p.patient_id}?tab=plans&plan=${p.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.patients?.full_name}</span>
                      <span className="block truncate text-sm text-muted">
                        {p.name}
                        {totals ? ` · ${totals.kcal} kcal/day` : ""}
                      </span>
                    </span>
                    <span className="hidden text-right text-sm text-muted sm:block">
                      {p.starts_on ? `${formatDate(p.starts_on)}${p.ends_on ? ` to ${formatDate(p.ends_on)}` : ""}` : `Updated ${formatDate(p.updated_at)}`}
                    </span>
                    <Badge tone={TONES[p.status]}>{LABELS[p.status].replace(/s$/, "")}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
