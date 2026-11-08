"use server";

import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type FindHit = { kind: "patient" | "food" | "template"; id: string; title: string; detail: string; href: string };

// Ctrl+K search: patients by name, phone or email, then (for clinicians) foods
// and templates. Row-level security limits each list to what the viewer may see.
export async function quickFind(query: string): Promise<FindHit[]> {
  const { membership } = await requireStaff();
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const like = `%${q.replace(/[%,()_\\]/g, "")}%`;
  const clinical = CLINICAL_ROLES.includes(membership.role);

  const [{ data: patients }, { data: foods }, { data: templates }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, phone, archived_at")
      .eq("practice_id", membership.practiceId)
      .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .order("archived_at", { nullsFirst: true })
      .order("full_name")
      .limit(6),
    clinical ? supabase.rpc("search_foods", { p_query: q, p_limit: 4 }) : Promise.resolve({ data: [] }),
    clinical ? supabase.from("templates").select("id, name, kind").ilike("name", like).order("is_favorite", { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
  ]);

  return [
    ...(patients ?? []).map((p) => ({
      kind: "patient" as const,
      id: p.id,
      title: p.full_name,
      detail: [p.phone, p.archived_at ? "Archived" : null].filter(Boolean).join(" · ") || "Patient",
      href: `/dashboard/patients/${p.id}`,
    })),
    ...(foods ?? []).map((f) => ({
      kind: "food" as const,
      id: f.id,
      title: f.name,
      detail: `${f.brand ? `${f.brand} · ` : ""}${Math.round(Number(f.kcal))} kcal per 100 g`,
      href: `/dashboard/foods?q=${encodeURIComponent(q)}&food=${f.id}`,
    })),
    ...(templates ?? []).map((t) => ({
      kind: "template" as const,
      id: t.id,
      title: t.name,
      detail: `${t.kind[0].toUpperCase()}${t.kind.slice(1)} template`,
      href: `/dashboard/templates?template=${t.id}`,
    })),
  ];
}
