import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { ALLERGEN_LABELS, amountLabel, round, SLOT_LABELS, type SavedContent, type Targets } from "@/lib/nutrition";
import { CLINICAL_ROLES } from "@/lib/roles";
import { shoppingAmount, shoppingList } from "@/lib/shopping-list";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "../../print-button";

export const metadata: Metadata = { title: "Meal plan" };

// A meal plan to print or save as PDF (and send on WhatsApp): the days with
// their meals, amounts and approved swaps, then a shopping list.
export default async function PlanPrint({ params, searchParams }: PageProps<"/print/plan/[id]">) {
  const { viewer, membership } = await requireStaff(CLINICAL_ROLES);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const withList = sp.list !== "0";
  const supabase = await createClient();
  const { data: plan } = await supabase.from("meal_plans").select("*, patients(full_name)").eq("id", id).maybeSingle();
  if (!plan || !plan.patients) notFound();
  const { data: allergies } = await supabase.from("patient_allergies").select("allergen, label").eq("patient_id", plan.patient_id);

  const content = plan.content as SavedContent;
  const targets = (plan.targets ?? {}) as Targets;
  const list = shoppingList(content);
  const many = content.days.length > 1;

  return (
    <main className="flex flex-1 justify-center bg-canvas px-4 py-8 print:bg-white print:p-0">
      <div className="w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/dashboard/patients/${plan.patient_id}?tab=plans`} className="text-sm text-muted hover:text-ink">
            Back
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`/print/plan/${id}${withList ? "?list=0" : ""}`} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
              {withList ? "Hide shopping list" : "Show shopping list"}
            </Link>
            <PrintButton />
          </div>
        </div>
        <p className="text-xs text-muted print:hidden">To send it on WhatsApp: Print, choose &quot;Save as PDF&quot;, then attach the file.</p>

        <article className="rounded-2xl border border-line bg-surface p-10 text-sm print:rounded-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-5">
            <div>
              <p className="text-xl font-semibold">{plan.name}</p>
              <p className="mt-1 text-muted">
                For {plan.patients.full_name}
                {plan.starts_on ? ` · from ${formatDate(plan.starts_on)}${plan.ends_on ? ` to ${formatDate(plan.ends_on)}` : ""}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{membership.practiceName}</p>
              {viewer.fullName && <p className="text-muted">{viewer.fullName}</p>}
            </div>
          </header>

          {(targets.kcal || allergies?.length) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line py-3 text-muted">
              {targets.kcal && (
                <span>
                  Daily target: {targets.kcal} kcal
                  {targets.protein_g ? ` · protein ${targets.protein_g} g` : ""}
                  {targets.carbs_g ? ` · carbs ${targets.carbs_g} g` : ""}
                  {targets.fat_g ? ` · fat ${targets.fat_g} g` : ""}
                </span>
              )}
              {allergies && allergies.length > 0 && <span>Avoid: {allergies.map((a) => (a.allergen === "other" ? a.label : ALLERGEN_LABELS[a.allergen])).join(", ")}</span>}
            </div>
          )}

          {content.days.map((d, i) => (
            <section key={i} className="break-inside-avoid border-b border-line py-5 last:border-b-0">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">{many ? d.label : "Your day"}</h2>
                <span className="text-muted tabular-nums">
                  {round(d.totals.kcal)} kcal · P {round(d.totals.protein_g)} · C {round(d.totals.carbs_g)} · F {round(d.totals.fat_g)}
                </span>
              </div>
              <div className="space-y-3">
                {d.meals.map((m) => (
                  <div key={m.key} className="break-inside-avoid">
                    <p className="font-medium">
                      {m.name || SLOT_LABELS[m.slot]}
                      {m.time ? <span className="font-normal text-muted"> · {m.time}</span> : null}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {m.items.map((it, j) => (
                        <li key={j}>
                          <span className="flex justify-between gap-4">
                            <span>{it.name}</span>
                            <span className="shrink-0 text-muted tabular-nums">{amountLabel(it)}</span>
                          </span>
                          {it.alternatives && it.alternatives.length > 0 && (
                            <span className="block pl-3 text-xs text-muted">Or: {it.alternatives.map((a) => `${a.name} (${amountLabel(a)})`).join("; ")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {m.notes && <p className="mt-1 text-xs text-muted">{m.notes}</p>}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {plan.notes && (
            <section className="break-inside-avoid border-t border-line pt-5">
              <h2 className="mb-1 text-base font-semibold">From your dietitian</h2>
              <p className="whitespace-pre-line">{plan.notes}</p>
            </section>
          )}

          {withList && list.items.length > 0 && (
            <section className="mt-6 border-t border-line pt-5 print:break-before-page print:mt-0 print:border-t-0 print:pt-0">
              <h2 className="text-base font-semibold">Shopping list</h2>
              <p className="mb-3 text-xs text-muted">
                For {list.days} days{content.days.length < 7 ? ", repeating the plan" : ""}. Amounts as eaten: buy a little extra for peel and bones, and remember cooked rice,
                pasta and legumes weigh more than dry.
              </p>
              <ul className="columns-1 gap-8 sm:columns-2 print:columns-2">
                {list.items.map((it) => (
                  <li key={it.name} className="flex break-inside-avoid items-baseline gap-2 py-1">
                    <span className="inline-block size-3 shrink-0 translate-y-0.5 rounded-sm border border-ink/40" aria-hidden />
                    <span className="flex-1">{it.name}</span>
                    <span className="shrink-0 text-muted tabular-nums">{shoppingAmount(it)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-10 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
            <span>{membership.practiceName}</span>
            <Logo className="text-xs opacity-70" />
          </footer>
        </article>
      </div>
    </main>
  );
}
