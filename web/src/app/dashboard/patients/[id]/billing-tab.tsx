import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { formatDate, todayIn } from "@/lib/format";
import { usd } from "@/lib/money";
import type { StaffMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createInvoice, sellPackage } from "../../billing/actions";
import { InvoiceForm, SellPackageForm } from "../../billing/forms";
import { PackageRenewal } from "../../billing/package-renewal";
import { InvoiceList } from "../../billing/invoice-list";

// Packages and invoices for one patient (owner and assistants).
export async function BillingTab({ patientId, membership, firstName }: { patientId: string; membership: StaffMembership; firstName?: string }) {
  const supabase = await createClient();
  const today = todayIn(membership.timezone);
  const [{ data: packages }, { data: usage }, { data: types }, { data: balances }] = await Promise.all([
    supabase.from("patient_packages").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("package_usage").select("patient_package_id, used, remaining").eq("patient_id", patientId),
    supabase.from("package_types").select("id, name, consultations, price_usd, valid_days").eq("practice_id", membership.practiceId).is("archived_at", null).order("name"),
    supabase.from("invoice_balances").select("due_usd").eq("patient_id", patientId),
  ]);
  const use = new Map((usage ?? []).map((u) => [u.patient_package_id, u]));
  const balance = (balances ?? []).reduce((a, b) => a + Number(b.due_usd), 0);

  return (
    <>
      {firstName && (
        <div className="mb-4">
          <PackageRenewal patientId={patientId} firstName={firstName} membership={membership} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Balance: <span className={`font-semibold ${balance > 0 ? "text-danger" : "text-success"}`}>{balance > 0 ? `${usd(balance)} due` : "Nothing due"}</span>
        </p>
        <div className="flex gap-2">
          <Dialog label="One-off charge" variant="secondary" title="New invoice">
            <InvoiceForm action={createInvoice.bind(null, patientId)} />
          </Dialog>
          <Dialog label="Sell package" icon={<Plus className="size-4" />} title="Sell a package">
            <SellPackageForm action={sellPackage.bind(null, patientId)} types={(types ?? []).map((t) => ({ ...t, price_usd: Number(t.price_usd) }))} today={today} />
          </Dialog>
        </div>
      </div>
      <Card className="mt-4">
        <SectionTitle>Packages</SectionTitle>
        {!packages?.length ? (
          <p className="px-5 pb-5 text-sm text-muted">No packages. Attended appointments are billed one by one.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {packages.map((p) => {
              const u = use.get(p.id);
              const state = p.cancelled_at ? "Cancelled" : p.expires_on < today ? "Expired" : (u?.remaining ?? 0) <= 0 ? "Used up" : "Active";
              return (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-sm text-muted">
                      {u?.used ?? 0} of {p.consultations_total} used · {formatDate(p.starts_on)} to {formatDate(p.expires_on)} · {usd(p.price_usd)}
                    </span>
                  </span>
                  <Badge tone={state === "Active" ? "green" : "gray"}>{state === "Active" ? `${u?.remaining} left` : state}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="mt-4">
        <SectionTitle>Invoices</SectionTitle>
        <div className="border-t border-line">
          <InvoiceList practiceId={membership.practiceId} rate={membership.lbpRate} patientId={patientId} />
        </div>
      </Card>
    </>
  );
}
