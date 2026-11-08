import { RefreshCw } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { formatDate, todayIn } from "@/lib/format";
import { BILLING_ROLES } from "@/lib/roles";
import type { StaffMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/time";
import { sellPackage } from "./actions";
import { SellPackageForm } from "./forms";

// Shown where a visit happens (appointment, consultation, patient billing)
// when the patient's package is on its last consultation or ends within two
// weeks: owners and assistants renew it in one step, others get a reminder.
// Row-level security hides packages from roles that don't see billing.
export async function PackageRenewal({ patientId, firstName, membership }: { patientId: string; firstName: string; membership: StaffMembership }) {
  const supabase = await createClient();
  const today = todayIn(membership.timezone);
  const { data: packages } = await supabase
    .from("patient_packages")
    .select("id, name, package_type_id, expires_on")
    .eq("patient_id", patientId)
    .is("cancelled_at", null)
    .gte("expires_on", today)
    .order("expires_on")
    .limit(1);
  const pkg = packages?.[0];
  if (!pkg) return null;
  const { data: usage } = await supabase.from("package_usage").select("remaining").eq("patient_package_id", pkg.id).maybeSingle();
  const remaining = usage?.remaining ?? 0;
  const endingSoon = pkg.expires_on <= addDays(today, 14);
  if (remaining > 1 && !endingSoon) return null;

  const canSell = BILLING_ROLES.includes(membership.role);
  const { data: types } = canSell
    ? await supabase.from("package_types").select("id, name, consultations, price_usd, valid_days").eq("practice_id", membership.practiceId).is("archived_at", null).order("name")
    : { data: [] };

  const what =
    remaining <= 0
      ? `${firstName} has used all consultations in ${pkg.name}.`
      : remaining === 1
        ? `${firstName} has 1 consultation left in ${pkg.name} (until ${formatDate(pkg.expires_on)}).`
        : `${pkg.name} ends on ${formatDate(pkg.expires_on)} with ${remaining} consultations left.`;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      <RefreshCw className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {what} {canSell ? "Offer a renewal at this visit?" : "Remind reception to offer a renewal."}
      </span>
      {canSell && (
        <Dialog label="Renew package" variant="secondary" triggerClassName="h-8 px-3" title={`Renew ${firstName}'s package`}>
          <SellPackageForm action={sellPackage.bind(null, patientId)} types={(types ?? []).map((t) => ({ ...t, price_usd: Number(t.price_usd) }))} today={today} defaultTypeId={pkg.package_type_id} />
        </Dialog>
      )}
    </div>
  );
}
