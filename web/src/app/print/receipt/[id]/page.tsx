import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { lbp, METHOD_LABELS, usd } from "@/lib/money";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PrintDocument } from "../../document";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPrint({ params }: PageProps<"/print/receipt/[id]">) {
  const { membership } = await requireStaff(BILLING_ROLES);
  const { id } = await params;
  const { data: p } = await (await createClient())
    .from("payments")
    .select("*, invoices(number, description, patient_id, patients(full_name, phone, email)), profiles(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!p || !p.invoices?.patients) notFound();
  const pt = p.invoices.patients;

  return (
    <PrintDocument
      kind="Receipt"
      number={`Receipt for invoice #${p.invoices.number}`}
      date={formatDate(p.paid_at)}
      practice={membership.practiceName}
      patient={{ name: pt.full_name, phone: pt.phone, email: pt.email }}
      rows={[
        { label: "For", value: p.invoices.description },
        { label: "Method", value: METHOD_LABELS[p.method] },
        ...(p.lbp_amount ? [{ label: "Paid in LBP", value: `${lbp(p.lbp_amount)} at ${Number(p.lbp_rate).toLocaleString("en-US")}` }] : []),
        ...(p.profiles?.full_name ? [{ label: "Received by", value: p.profiles.full_name }] : []),
        ...(p.note ? [{ label: "Note", value: p.note }] : []),
      ]}
      total={{ label: "Amount received", value: usd(p.amount_usd) }}
      back={`/dashboard/patients/${p.invoices.patient_id}?tab=billing`}
    />
  );
}
