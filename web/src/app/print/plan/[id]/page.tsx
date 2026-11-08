import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { ALLERGEN_LABELS, round, type SavedContent, type Targets } from "@/lib/nutrition";
import { amountIn, dayLabel, PLAN_LANGS, PLAN_WORDS, suggestFoodName, weightIn, type PlanLang } from "@/lib/plan-i18n";
import { CLINICAL_ROLES } from "@/lib/roles";
import { shoppingList } from "@/lib/shopping-list";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "../../print-button";
import { NameEditor } from "../name-editor";

export const metadata: Metadata = { title: "Meal plan" };

const ALLERGENS_IN: Record<"fr" | "ar", Record<string, string>> = {
  fr: { gluten: "Gluten", dairy: "Produits laitiers", egg: "Œuf", peanut: "Arachide", tree_nut: "Fruits à coque", sesame: "Sésame", soy: "Soja", fish: "Poisson", shellfish: "Fruits de mer" },
  ar: { gluten: "الغلوتين", dairy: "الحليب ومشتقاته", egg: "البيض", peanut: "الفول السوداني", tree_nut: "المكسرات", sesame: "السمسم", soy: "الصويا", fish: "السمك", shellfish: "القشريات" },
};

// A meal plan to print or save as PDF, in English, French or Arabic: the days
// with their meals, amounts and approved swaps, then a shopping list.
export default async function PlanPrint({ params, searchParams }: PageProps<"/print/plan/[id]">) {
  const { viewer, membership } = await requireStaff(CLINICAL_ROLES);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const lang: PlanLang = sp.lang === "ar" || sp.lang === "fr" ? sp.lang : "en";
  const withList = sp.list !== "0";
  const w = PLAN_WORDS[lang];
  const supabase = await createClient();
  const { data: plan } = await supabase.from("meal_plans").select("*, patients(full_name)").eq("id", id).maybeSingle();
  if (!plan || !plan.patients) notFound();
  const content = plan.content as SavedContent;
  const foodIds = [...new Set(content.days.flatMap((d) => d.meals.flatMap((m) => m.items.flatMap((it) => [it.food_id, ...(it.alternatives ?? []).map((a) => a.food_id)]))))];

  const [{ data: allergies }, { data: translations }] = await Promise.all([
    supabase.from("patient_allergies").select("allergen, label").eq("patient_id", plan.patient_id),
    lang !== "en" && foodIds.length
      ? supabase.from("food_translations").select("food_id, name, practice_id").eq("lang", lang).in("food_id", foodIds)
      : Promise.resolve({ data: [] as { food_id: string; name: string; practice_id: string | null }[] }),
  ]);
  // The practice's own name wins over the Nutrix default.
  const names = new Map<string, string>();
  for (const t of (translations ?? []).sort((a, b) => Number(Boolean(a.practice_id)) - Number(Boolean(b.practice_id)))) names.set(t.food_id, t.name);
  const own = new Map((translations ?? []).filter((t) => t.practice_id).map((t) => [t.food_id, t.name]));
  const nameOf = (foodId: string, fallback: string) => (lang === "en" ? fallback : (names.get(foodId) ?? fallback));

  const targets = (plan.targets ?? {}) as Targets;
  const list = shoppingList(content);
  const many = content.days.length > 1;
  const english = new Map<string, string>();
  for (const d of content.days) for (const m of d.meals) for (const it of m.items) {
    english.set(it.food_id, it.name);
    for (const a of it.alternatives ?? []) english.set(a.food_id, a.name);
  }
  const allergyText = (allergies ?? []).map((a) => (a.allergen === "other" ? a.label : lang === "en" ? ALLERGEN_LABELS[a.allergen] : ALLERGENS_IN[lang][a.allergen])).join(lang === "ar" ? "، " : ", ");
  const dateFmt = (d: string) => (lang === "en" ? formatDate(d) : new Date(`${d}T00:00:00Z`).toLocaleDateString(lang === "fr" ? "fr-FR" : "ar-LB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }));
  const link = (q: Record<string, string>) => `/print/plan/${id}?${new URLSearchParams({ ...(lang !== "en" ? { lang } : {}), ...(withList ? {} : { list: "0" }), ...q })}`;

  return (
    <main className="flex flex-1 justify-center bg-canvas px-4 py-8 print:bg-white print:p-0">
      <div className="w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/dashboard/patients/${plan.patient_id}?tab=plans`} className="text-sm text-muted hover:text-ink">
            Back
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" role="radiogroup" aria-label="Language">
              {PLAN_LANGS.map((l) => (
                <Link
                  key={l.id}
                  href={`/print/plan/${id}?${new URLSearchParams({ ...(l.id !== "en" ? { lang: l.id } : {}), ...(withList ? {} : { list: "0" }) })}`}
                  role="radio"
                  aria-checked={lang === l.id}
                  className={`h-8 rounded-lg px-3 text-xs leading-8 font-medium ${lang === l.id ? "bg-ink text-white" : "bg-surface text-ink/80 hover:text-ink"}`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <Link href={link(withList ? { list: "0" } : {})} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
              {withList ? "Hide shopping list" : "Show shopping list"}
            </Link>
            <PrintButton />
          </div>
        </div>
        <p className="text-xs text-muted print:hidden">To send it on WhatsApp: Print, choose &quot;Save as PDF&quot;, then attach the file. Your notes print as you wrote them.</p>

        {lang !== "en" && (
          <NameEditor
            lang={lang}
            foods={[...english].map(([fid, en]) => ({ id: fid, name: en, current: own.get(fid) ?? names.get(fid) ?? "", suggestion: suggestFoodName(en, lang) }))}
          />
        )}

        <article dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="rounded-2xl border border-line bg-surface p-10 text-sm print:rounded-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-5">
            <div>
              <p className="text-xl font-semibold">{plan.name}</p>
              <p className="mt-1 text-muted">
                {w.forPatient} {plan.patients.full_name}
                {plan.starts_on ? ` · ${w.from} ${dateFmt(plan.starts_on)}${plan.ends_on ? ` ${w.to} ${dateFmt(plan.ends_on)}` : ""}` : ""}
              </p>
            </div>
            <div className="text-end">
              <p className="font-semibold">{membership.practiceName}</p>
              {viewer.fullName && <p className="text-muted">{viewer.fullName}</p>}
            </div>
          </header>

          {(targets.kcal || allergyText) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line py-3 text-muted">
              {targets.kcal && (
                <span>
                  {w.dailyTarget}: {targets.kcal} {w.kcal}
                  {targets.protein_g ? ` · ${w.protein} ${targets.protein_g} ${w.g}` : ""}
                  {targets.carbs_g ? ` · ${w.carbs} ${targets.carbs_g} ${w.g}` : ""}
                  {targets.fat_g ? ` · ${w.fat} ${targets.fat_g} ${w.g}` : ""}
                </span>
              )}
              {allergyText && (
                <span>
                  {w.avoid}: {allergyText}
                </span>
              )}
            </div>
          )}

          {content.days.map((d, i) => (
            <section key={i} className="break-inside-avoid border-b border-line py-5 last:border-b-0">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">{many ? dayLabel(d.label, lang) : w.yourDay}</h2>
                <span className="text-muted tabular-nums">
                  {round(d.totals.kcal)} {w.kcal}
                </span>
              </div>
              <div className="space-y-3">
                {d.meals.map((m) => (
                  <div key={m.key} className="break-inside-avoid">
                    <p className="font-medium">
                      {m.name || w.slots[m.slot]}
                      {m.time ? <span className="font-normal text-muted"> · {m.time}</span> : null}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {m.items.map((it, j) => (
                        <li key={j}>
                          <span className="flex justify-between gap-4">
                            <span>{nameOf(it.food_id, it.name)}</span>
                            <span className="shrink-0 text-muted tabular-nums" dir="ltr">
                              {amountIn(it, lang)}
                            </span>
                          </span>
                          {it.alternatives && it.alternatives.length > 0 && (
                            <span className="block ps-3 text-xs text-muted">
                              {w.or}: {it.alternatives.map((a) => `${nameOf(a.food_id, a.name)} (${amountIn(a, lang)})`).join(lang === "ar" ? "؛ " : "; ")}
                            </span>
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
              <h2 className="mb-1 text-base font-semibold">{w.fromDietitian}</h2>
              <p className="whitespace-pre-line" dir="auto">
                {plan.notes}
              </p>
            </section>
          )}

          {withList && list.items.length > 0 && (
            <section className="mt-6 border-t border-line pt-5 print:mt-0 print:break-before-page print:border-t-0 print:pt-0">
              <h2 className="text-base font-semibold">{w.shoppingList}</h2>
              <p className="mb-3 text-xs text-muted">
                {w.shoppingFor(list.days, content.days.length < 7)} {w.shoppingNote}
              </p>
              <ul className="columns-1 gap-8 sm:columns-2 print:columns-2">
                {list.items.map((it) => {
                  const fid = [...english].find(([, en]) => en === it.name)?.[0];
                  return (
                    <li key={it.name} className="flex break-inside-avoid items-baseline gap-2 py-1">
                      <span className="inline-block size-3 shrink-0 translate-y-0.5 rounded-sm border border-ink/40" aria-hidden />
                      <span className="flex-1">{fid ? nameOf(fid, it.name) : it.name}</span>
                      <span className="shrink-0 text-muted tabular-nums" dir="ltr">
                        {it.servings && lang === "en" ? `${round(it.servings.qty * 2) / 2} x ${it.servings.label.replace(/^1\s+/, "")} (${weightIn(it.grams, lang)})` : weightIn(it.grams, lang)}
                      </span>
                    </li>
                  );
                })}
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
