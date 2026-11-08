import type { Metadata } from "next";
import { FlaskConical, LifeBuoy } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { PageTabs, TabPanel } from "@/components/page-tabs";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { usd } from "@/lib/money";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createLab, leaveSupport, openPracticeAs, openPracticeForm, setOverride } from "./actions";
import { OpenAsForm, OverrideForm, RolloutSelect } from "./forms";

export const metadata: Metadata = { title: "Platform" };

const TABS = ["practices", "lab"] as const;
const LAB_ROLES = [
  { role: "owner", label: "Owner" },
  { role: "dietitian", label: "Dietitian" },
  { role: "assistant", label: "Assistant" },
  { role: "patient", label: "Patient" },
] as const;
const ROLLOUT = {
  off: { label: "Off", tone: "gray" },
  lab: { label: "Lab only", tone: "amber" },
  all: { label: "Everyone", tone: "green" },
} as const;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const viewer = await requirePlatformAdmin();
  const { tab } = await searchParams;
  const supabase = await createClient();
  const [{ data: practices }, { data: features }, { data: overrides }] = await Promise.all([
    supabase.rpc("admin_practice_overview"),
    supabase.from("features").select("key, name, description, rollout").order("created_at"),
    supabase.from("practice_feature_overrides").select("practice_id, feature_key, enabled"),
  ]);
  const list = practices ?? [];
  const real = list.filter((p) => !p.is_lab);
  const lab = list.find((p) => p.is_lab);
  const nameOf = new Map(list.map((p) => [p.practice_id, p.name]));
  const options = list.map((p) => ({ id: p.practice_id, name: p.is_lab ? `${p.name} (lab)` : p.name }));
  const totals = {
    practices: real.length,
    patients: real.reduce((a, p) => a + p.patients, 0),
    onApp: real.reduce((a, p) => a + p.patients_on_app, 0),
    collected: real.reduce((a, p) => a + Number(p.collected_30d), 0),
  };
  const visit = viewer.supportPractice;

  return (
    <div className="space-y-6">
      <PageHeader title="Nutrix platform" description="Practices, support access and the lab. Patient data stays private unless you open a practice." />

      {visit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-strong bg-brand/25 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <LifeBuoy className="size-4" /> You are in <strong>{visit.name}</strong> as <strong>{visit.role}</strong>.
          </span>
          <span className="flex gap-2">
            <form action={openPracticeAs.bind(null, visit.id, visit.role)}>
              <button className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-medium">Continue</button>
            </form>
            <form action={leaveSupport}>
              <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white">Leave</button>
            </form>
          </span>
        </div>
      )}

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Practices", String(totals.practices)],
          ["Patients", String(totals.patients)],
          ["Patients on the app", String(totals.onApp)],
          ["Collected by practices, 30 days", usd(totals.collected)],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      <PageTabs
        instant
        base="/admin"
        active={TABS.includes(tab as (typeof TABS)[number]) ? (tab as string) : "practices"}
        tabs={[
          { id: "practices", label: "Practices", count: real.length },
          { id: "lab", label: "Lab" },
        ]}
      />

      <TabPanel id="practices" tabs={TABS}>
        <Card className="overflow-x-auto">
          {!real.length ? (
            <p className="p-5 text-sm text-muted">No practices yet.</p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  {["Practice", "Owner", "Staff", "Patients", "On app", "Active plans", "Visits, 30 d", "Collected, 30 d", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {real.map((p) => (
                  <tr key={p.practice_id}>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">Since {formatDate(p.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{p.owner_name || "-"}</span>
                      <span className="block text-xs text-muted">{p.owner_email}</span>
                    </td>
                    <td className="px-4 py-3">{p.staff}</td>
                    <td className="px-4 py-3">{p.patients}</td>
                    <td className="px-4 py-3">{p.patients_on_app}</td>
                    <td className="px-4 py-3">{p.active_plans}</td>
                    <td className="px-4 py-3">{p.appointments_30d}</td>
                    <td className="px-4 py-3">{usd(p.collected_30d)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={openPracticeAs.bind(null, p.practice_id, "owner")}>
                        <button className="h-8 rounded-lg border border-line px-3 text-xs font-medium hover:border-ink/30">Open as owner</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <p className="mt-2 text-xs text-muted">Opening a practice shows it exactly as that role sees it. Changes you make there are real.</p>
      </TabPanel>

      <TabPanel id="lab" tabs={TABS}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <FlaskConical className="size-4" /> Your lab
            </h2>
            {lab ? (
              <>
                <p className="mt-1 mb-4 text-sm text-muted">
                  {lab.name}: a practice only you use. Features set to &quot;Lab only&quot; are on here. Open it as any role, including a patient, to see what each person sees.
                </p>
                <div className="flex flex-wrap gap-2">
                  {LAB_ROLES.map(({ role, label }) => (
                    <form key={role} action={openPracticeAs.bind(null, lab.practice_id, role)}>
                      <button className={`h-9 rounded-lg px-3 text-sm font-medium ${role === "patient" ? "bg-brand" : "border border-line bg-surface hover:border-ink/30"}`}>{label}</button>
                    </form>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 mb-4 text-sm text-muted">A test practice only you use, to try new features before anyone else. Open it as owner, dietitian, assistant or patient.</p>
                <form action={createLab}>
                  <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white">Create my lab practice</button>
                </form>
              </>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Open any practice as a role</h2>
            <p className="mt-1 mb-4 text-sm text-muted">See a real practice exactly as one of its people does. Changes are real. Patient view is lab only.</p>
            {options.length ? <OpenAsForm action={openPracticeForm} practices={options} /> : <p className="text-sm text-muted">No practices yet.</p>}
          </Card>
        </div>

        <Card className="mt-4">
          <div className="border-b border-line p-5">
            <h2 className="font-semibold">Features</h2>
            <p className="mt-1 text-sm text-muted">New features start as &quot;Lab only&quot;. When they work, switch them to Everyone. Exceptions turn a feature on early, or off, for one practice.</p>
          </div>
          <ul className="divide-y divide-line">
            {(features ?? []).map((f) => {
              const exceptions = (overrides ?? []).filter((o) => o.feature_key === f.key);
              const tone = ROLLOUT[f.rollout as keyof typeof ROLLOUT] ?? ROLLOUT.off;
              return (
                <li key={f.key} className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {f.name} <Badge tone={tone.tone}>{tone.label}</Badge>
                    </p>
                    <p className="text-sm text-muted">{f.description}</p>
                    {exceptions.length > 0 && (
                      <p className="text-xs text-muted">
                        Exceptions:{" "}
                        {exceptions.map((o, i) => (
                          <span key={o.practice_id}>
                            {i > 0 && ", "}
                            {nameOf.get(o.practice_id) ?? "Practice"} <strong className={o.enabled ? "text-success" : "text-danger"}>{o.enabled ? "on" : "off"}</strong>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <RolloutSelect featureKey={f.key} rollout={f.rollout} label={f.name} />
                    {options.length > 0 && (
                      <Dialog label="Exception" title={`${f.name}: one practice`} variant="secondary" triggerClassName="h-9 px-3 text-xs">
                        <OverrideForm action={setOverride.bind(null, f.key)} practices={options} />
                      </Dialog>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </TabPanel>
    </div>
  );
}
