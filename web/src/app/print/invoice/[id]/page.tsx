import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { lbp, METHOD_LABELS, usd } from "@/lib/money";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PrintDocument } from "../../document";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePrint({ params }: PageProps<"/print/invoice/[id]">) {
  const { membership } = await requireStaff(BILLING_ROLES);
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: inv }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("*, patients(full_name, phone, email)").eq("id", id).maybeSingle(),
    supabase.from("payments").select("amount_usd, method, lbp_amount, paid_at").eq("invoice_id", id).order("paid_at"),
  ]);
  if (!inv || !inv.patients) notFound();
  const paid = (payments ?? []).reduce((a, p) => a + Number(p.amount_usd), 0);
  const due = inv.voided_at ? 0 : Number(inv.amount_usd) - paid;

  return (
    <PrintDocument
      kind={inv.voided_at ? "Invoice (void)" : "Invoice"}
      number={`Invoice #${inv.number}`}
      date={formatDate(inv.issued_on)}
      practice={membership.practiceName}
      patient={{ name: inv.patients.full_name, phone: inv.patients.phone, email: inv.patients.email }}
      rows={[
        { label: inv.description, value: usd(inv.amount_usd) },
        ...(payments ?? []).map((p) => ({
          label: `Paid ${formatDate(p.paid_at)} · ${METHOD_LABELS[p.method]}${p.lbp_amount ? ` (${lbp(p.lbp_amount)})` : ""}`,
          value: `-${usd(p.amount_usd)}`,
        })),
      ]}
      total={{ label: inv.voided_at ? "Void" : due <= 0 ? "Paid in full" : "Balance due", value: usd(Math.max(0, due)) }}
      footer={inv.voided_at ? `Voided${inv.void_reason ? `: ${inv.void_reason}` : ""}.` : null}
      back={`/dashboard/patients/${inv.patient_id}?tab=billing`}
    />
  );
}
