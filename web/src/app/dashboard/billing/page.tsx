import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { PageTabs, TabPanel } from "@/components/page-tabs";
import { RowMenu } from "@/components/row-menu";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { formatDate, todayIn } from "@/lib/format";
import { lbp, METHOD_LABELS, usd, type PaymentMethod } from "@/lib/money";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatWhen, localToIso } from "@/lib/time";
import { archivePackageType, archiveService, refundPayment, savePackageType, saveService } from "./actions";
import { PackageTypeForm, ServiceForm } from "./forms";
import { InvoiceList } from "./invoice-list";

export const metadata: Metadata = { title: "Billing" };

const TABS = ["overview", "invoices", "payments", "catalogue"] as const;

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const { membership } = await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const tz = membership.timezone;
  const today = todayIn(tz);
  const isOwner = membership.role === "owner";
  const monthStart = `${today.slice(0, 7)}-01`;
  // First day of the month five months ago.
  const [y, m] = today.split("-").map(Number);
  const sixAgo = new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10);

  const supabase = await createClient();
  const [{ data: payments }, { data: balances }, { data: packages }, { data: usage }, { data: services }, { data: types }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount_usd, method, lbp_amount, paid_at, note, invoices(number, description, patient_id, patients(full_name))")
      .eq("practice_id", membership.practiceId)
      .gte("paid_at", localToIso(sixAgo, "00:00", tz))
      .order("paid_at", { ascending: false }),
    supabase.from("invoice_balances").select("patient_id, due_usd").eq("practice_id", membership.practiceId).gt("due_usd", 0),
    supabase
      .from("patient_packages")
      .select("id, name, expires_on, patient_id, patients(full_name)")
      .eq("practice_id", membership.practiceId)
      .is("cancelled_at", null)
      .gte("expires_on", today)
      .lte("expires_on", addDays(today, 14))
      .order("expires_on"),
    supabase.from("package_usage").select("patient_package_id, remaining").eq("practice_id", membership.practiceId),
    supabase.from("services").select("*").eq("practice_id", membership.practiceId).is("archived_at", null).order("name"),
    supabase.from("package_types").select("*").eq("practice_id", membership.practiceId).is("archived_at", null).order("name"),
  ]);

  const local = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const thisMonth = (payments ?? []).filter((p) => local(p.paid_at) >= monthStart);
  const collected = thisMonth.reduce((a, p) => a + Number(p.amount_usd), 0);
  const outstanding = (balances ?? []).reduce((a, b) => a + Number(b.due_usd), 0);
  const debtors = new Map<string, number>();
  for (const b of balances ?? []) if (b.patient_id) debtors.set(b.patient_id, (debtors.get(b.patient_id) ?? 0) + Number(b.due_usd));
  const byMethod = new Map<PaymentMethod, number>();
  for (const p of thisMonth) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount_usd));
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(y, m - 6 + i, 1)).toISOString().slice(0, 7));
  const perMonth = months.map((mo) => ({ mo, total: (payments ?? []).filter((p) => local(p.paid_at).startsWith(mo)).reduce((a, p) => a + Number(p.amount_usd), 0) }));
  const peak = Math.max(1, ...perMonth.map((x) => x.total));
  const remaining = new Map((usage ?? []).map((u) => [u.patient_package_id, u.remaining]));
  const expiring = (packages ?? []).filter((p) => (remaining.get(p.id) ?? 0) > 0);
  const tab = TABS.includes(sp.tab as (typeof TABS)[number]) ? (sp.tab as string) : "overview";

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Packages, invoices and payments. Prices in USD; LBP cash at your practice rate." />
      <PageTabs
        instant
        base="/dashboard/billing"
        active={tab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "invoices", label: "Invoices", count: balances?.length },
          { id: "payments", label: "Payments" },
          { id: "catalogue", label: "Services & packages" },
        ]}
      />

      <TabPanel id="overview" tabs={TABS}>
        <div className="stagger grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm text-muted">Collected this month</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{usd(collected)}</p>
            <p className="text-xs text-muted">{thisMonth.length} payment{thisMonth.length === 1 ? "" : "s"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted">Outstanding</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${outstanding > 0 ? "text-danger" : ""}`}>{usd(outstanding)}</p>
            <p className="text-xs text-muted">{debtors.size} patient{debtors.size === 1 ? "" : "s"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted">Packages ending in 14 days</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{expiring.length}</p>
            <p className="text-xs text-muted">with consultations left</p>
          </Card>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Collected per month</h2>
            <div className="mt-4 flex h-40 items-end gap-3">
              {perMonth.map(({ mo, total }) => (
                <div key={mo} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs tabular-nums text-muted">{total ? usd(Math.round(total)) : ""}</span>
                  <div className="w-full rounded-t-md bg-ink/85" style={{ height: `${Math.max(2, (total / peak) * 100)}px` }} title={usd(total)} />
                  <span className="text-xs text-muted">{new Date(`${mo}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
                </div>
              ))}
            </div>
            {byMethod.size > 0 && (
              <p className="mt-4 text-xs text-muted">
                This month: {[...byMethod].map(([k, v]) => `${METHOD_LABELS[k]} ${usd(v)}`).join(" · ")}
              </p>
            )}
          </Card>
          <Card>
            <SectionTitle>Packages ending soon</SectionTitle>
            {!expiring.length ? (
              <p className="px-5 pb-5 text-sm text-muted">No package with consultations left ends in the next 14 days.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {expiring.map((p) => (
                  <li key={p.id}>
                    <Link href={`/dashboard/patients/${p.patient_id}?tab=billing`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.patients?.full_name}</span>
                        <span className="block text-sm text-muted">
                          {p.name} · {remaining.get(p.id)} left
                        </span>
                      </span>
                      <Badge tone="amber">Ends {formatDate(p.expires_on)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="invoices" tabs={TABS}>
        <Card>
          <SectionTitle>Outstanding</SectionTitle>
          <div className="border-t border-line">
            <InvoiceList practiceId={membership.practiceId} rate={membership.lbpRate} onlyDue />
          </div>
        </Card>
        <Card className="mt-4">
          <SectionTitle>All invoices</SectionTitle>
          <div className="border-t border-line">
            <InvoiceList practiceId={membership.practiceId} rate={membership.lbpRate} />
          </div>
        </Card>
        <p className="mt-2 text-xs text-muted">Sell a package or bill a one-off charge from the patient&apos;s file. Attended appointments without a package are billed automatically.</p>
      </TabPanel>

      <TabPanel id="payments" tabs={TABS}>
        <Card>
          {!payments?.length ? (
            <EmptyState>
              <span className="block pt-5">No payments in the last six months.</span>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.invoices?.patients?.full_name}</span>
                    <span className="block truncate text-sm text-muted">
                      #{p.invoices?.number} {p.invoices?.description} · {formatWhen(p.paid_at, tz)}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block font-medium">{usd(p.amount_usd)}</span>
                    <span className="block text-xs text-muted">{p.method === "cash_lbp" && p.lbp_amount ? lbp(p.lbp_amount) : METHOD_LABELS[p.method]}</span>
                  </span>
                  <RowMenu
                    items={[
                      { kind: "link", label: "Print receipt", href: `/print/receipt/${p.id}` },
                      { kind: "action", label: "Refund", danger: true, action: refundPayment.bind(null, p.id), confirm: `Refund ${usd(p.amount_usd)}? The invoice becomes due again.` },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </TabPanel>

      <TabPanel id="catalogue" tabs={TABS}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle
              action={
                isOwner && (
                  <Dialog label="Add" variant="secondary" icon={<Plus className="size-4" />} triggerClassName="h-8 px-3" title="New service">
                    <ServiceForm action={saveService.bind(null, null)} />
                  </Dialog>
                )
              }
            >
              Consultations
            </SectionTitle>
            {!services?.length ? (
              <p className="px-5 pb-5 text-sm text-muted">No services yet, e.g. &quot;First consultation, 60 min, $50&quot;.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{s.name}</span>
                      <span className="block text-sm text-muted">{s.duration_min} min</span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">{usd(s.price_usd)}</span>
                    {isOwner && (
                      <RowMenu
                        items={[
                          { kind: "dialog", label: "Edit", title: "Edit service", content: <ServiceForm action={saveService.bind(null, s.id)} service={{ ...s, price_usd: Number(s.price_usd) }} /> },
                          { kind: "action", label: "Remove", danger: true, action: archiveService.bind(null, s.id), confirm: `Remove "${s.name}"?` },
                        ]}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <SectionTitle
              action={
                isOwner && (
                  <Dialog label="Add" variant="secondary" icon={<Plus className="size-4" />} triggerClassName="h-8 px-3" title="New package">
                    <PackageTypeForm action={savePackageType.bind(null, null)} />
                  </Dialog>
                )
              }
            >
              Packages
            </SectionTitle>
            {!types?.length ? (
              <p className="px-5 pb-5 text-sm text-muted">No packages yet, e.g. &quot;4 follow-ups within 60 days, $140&quot;.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {types.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{t.name}</span>
                      <span className="block text-sm text-muted">
                        {t.consultations} consultations · {t.valid_days} days
                      </span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">{usd(t.price_usd)}</span>
                    {isOwner && (
                      <RowMenu
                        items={[
                          { kind: "dialog", label: "Edit", title: "Edit package", content: <PackageTypeForm action={savePackageType.bind(null, t.id)} pkg={{ ...t, price_usd: Number(t.price_usd) }} /> },
                          { kind: "action", label: "Remove", danger: true, action: archivePackageType.bind(null, t.id), confirm: `Remove "${t.name}"? Packages already sold stay valid.` },
                        ]}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        {!isOwner && <p className="mt-2 text-xs text-muted">Only the practice owner can change prices.</p>}
      </TabPanel>
    </div>
  );
}
