import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Star } from "lucide-react";
import { PageTabs } from "@/components/page-tabs";
import { PlanBuilder, type TemplateKind } from "@/components/plan-builder";
import { RouteModal } from "@/components/route-modal";
import { RowMenu } from "@/components/row-menu";
import { Badge, buttonClass, Card, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { contentToDays, type SavedContent } from "@/lib/nutrition";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { deleteTemplate, duplicateTemplate, saveTemplateAction, setTemplateFavorite } from "../plan-actions";

export const metadata: Metadata = { title: "Templates" };

const KINDS: { id: TemplateKind; label: string; plural: string; hint: string }[] = [
  { id: "meal", label: "Meal", plural: "Meals", hint: "One meal, e.g. a breakfast you reuse" },
  { id: "day", label: "Daily", plural: "Days", hint: "A full day of meals" },
  { id: "week", label: "Weekly", plural: "Weeks", hint: "Monday to Sunday" },
  { id: "program", label: "Program", plural: "Programs", hint: "Several weeks, up to 12" },
];

export default async function TemplatesPage({ searchParams }: PageProps<"/dashboard/templates">) {
  await requireStaff(CLINICAL_ROLES);
  const sp = await searchParams;
  const kind = KINDS.some((k) => k.id === sp.tab) ? (sp.tab as TemplateKind) : null;
  const query = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const favorites = sp.fav === "1";

  const supabase = await createClient();
  // Row-level security: only templates you own.
  const { data: all } = await supabase.from("templates").select("*").order("is_favorite", { ascending: false }).order("updated_at", { ascending: false });
  const list = (all ?? []).filter(
    (t) =>
      (!kind || t.kind === kind) &&
      (!favorites || t.is_favorite) &&
      (!query || `${t.name} ${t.category ?? ""}`.toLowerCase().includes(query.toLowerCase())),
  );

  const param = typeof sp.template === "string" ? sp.template : null;
  const open = param && param !== "new" ? all?.find((t) => t.id === param) : null;
  const newKind = KINDS.some((k) => k.id === sp.kind) ? (sp.kind as TemplateKind) : "day";
  const base = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (kind) p.set("tab", kind);
    if (query) p.set("q", query);
    if (favorites) p.set("fav", "1");
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/dashboard/templates?${p}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Templates" description="Your private library. Nobody else in the practice sees it, and editing a template never changes plans already given." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KINDS.map((k) => (
          <Link key={k.id} href={base({ template: "new", kind: k.id })} scroll={false} className="group rounded-xl border border-dashed border-line bg-surface p-4 transition hover:border-ink/30">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="size-4 text-brand-strong" /> New {k.label.toLowerCase()} template
            </span>
            <span className="mt-1 block text-xs text-muted">{k.hint}</span>
          </Link>
        ))}
      </div>

      <PageTabs
        base={`/dashboard/templates?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(favorites ? { fav: "1" } : {}) })}`}
        active={kind ?? "all"}
        tabs={[{ id: "all", label: "All", count: all?.length }, ...KINDS.map((k) => ({ id: k.id, label: k.plural, count: all?.filter((t) => t.kind === k.id).length }))]}
      />

      <form className="flex flex-wrap gap-2" role="search">
        {kind && <input type="hidden" name="tab" value={kind} />}
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={query} placeholder="Search name or category" className={`${inputClass} pl-10`} />
        </div>
        <Link href={base({ fav: favorites ? null : "1" })} className={buttonClass(favorites ? "primary" : "secondary", "h-11 rounded-xl")}>
          <Star className={`size-4 ${favorites ? "fill-brand text-brand" : ""}`} /> Favourites
        </Link>
      </form>

      <Card>
        {!list.length ? (
          <EmptyState>
            <span className="block pt-5">{all?.length ? "No template matches." : "No templates yet. Start one above, or save any patient plan as a template."}</span>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((t) => {
              const c = t.content as SavedContent;
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                  {t.is_favorite ? <Star className="size-4 shrink-0 fill-brand text-brand-strong" aria-label="Favourite" /> : <span className="size-4 shrink-0" />}
                  <Link href={base({ template: t.id })} scroll={false} className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium hover:underline">{t.name}</span>
                      <Badge tone="gray">{KINDS.find((k) => k.id === t.kind)?.label}</Badge>
                      {t.category && <Badge tone="blue">{t.category}</Badge>}
                    </span>
                    <span className="block text-sm text-muted tabular-nums">
                      {c.totals ? `${c.totals.kcal} kcal${c.days.length > 1 ? " average day" : ""} · ` : ""}
                      {c.days.length > 1 ? `${c.days.length} days · ` : ""}updated {formatDate(t.updated_at)}
                    </span>
                  </Link>
                  <RowMenu
                    items={[
                      { kind: "link", label: "Open", href: base({ template: t.id }) },
                      { kind: "action", label: t.is_favorite ? "Remove from favourites" : "Add to favourites", action: setTemplateFavorite.bind(null, t.id, !t.is_favorite) },
                      { kind: "action", label: "Duplicate", action: duplicateTemplate.bind(null, t.id) },
                      { kind: "action", label: "Delete", danger: true, action: deleteTemplate.bind(null, t.id), confirm: `Delete "${t.name}"? Plans made from it are not affected.` },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {param && (param === "new" || open) && (
        <RouteModal
          param={["template", "kind"]}
          size="xl"
          title={open ? open.name : `New ${KINDS.find((k) => k.id === newKind)?.label.toLowerCase()} template`}
          description={open ? "Changes apply to new plans only." : undefined}
        >
          <PlanBuilder
            mode="template"
            kind={open?.kind ?? newKind}
            closeParams={["template", "kind"]}
            initialMeta={open ? { name: open.name, category: open.category ?? "", description: open.description ?? "" } : { name: "" }}
            initialDays={open ? contentToDays(open.content as SavedContent) : []}
            onSave={saveTemplateAction.bind(null, open?.id ?? null, open?.kind ?? newKind)}
          />
        </RouteModal>
      )}
    </div>
  );
}
