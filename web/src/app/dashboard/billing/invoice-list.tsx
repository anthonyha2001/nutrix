import Link from "next/link";
import { RowMenu } from "@/components/row-menu";
import { Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS, invoiceStatus, usd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { recordPayment, voidInvoice } from "./actions";
import { PaymentForm, VoidForm } from "./forms";

// Invoices with what they still owe. `patientId` limits to one patient.
export async function InvoiceList({ practiceId, rate, patientId, onlyDue = false }: { practiceId: string; rate: number; patientId?: string; onlyDue?: boolean }) {
  const supabase = await createClient();
  let q = supabase
    .from("invoices")
    .select("id, number, issued_on, description, amount_usd, voided_at, patient_id, patients(full_name)")
    .eq("practice_id", practiceId)
    .order("number", { ascending: false })
    .limit(300);
  if (patientId) q = q.eq("patient_id", patientId);
  const [{ data: invoices }, { data: balances }] = await Promise.all([
    q,
    supabase.from("invoice_balances").select("invoice_id, due_usd, paid_usd").eq("practice_id", practiceId),
  ]);
  const due = new Map((balances ?? []).map((b) => [b.invoice_id, Number(b.due_usd)]));
  const rows = (invoices ?? []).filter((i) => !onlyDue || (due.get(i.id) ?? 0) > 0);
  if (!rows.length) {
    return (
      <EmptyState>
        <span className="block pt-5">{onlyDue ? "Nothing outstanding." : "No invoices yet."}</span>
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((i) => {
        const d = due.get(i.id) ?? 0;
        const status = invoiceStatus(Number(i.amount_usd), d, Boolean(i.voided_at));
        return (
          <li key={i.id} className="flex items-center gap-3 px-5 py-3">
            <span className="w-12 shrink-0 text-sm text-muted tabular-nums">#{i.number}</span>
            <span className="min-w-0 flex-1">
              {!patientId && (
                <Link href={`/dashboard/patients/${i.patient_id}?tab=billing`} className="block truncate font-medium hover:underline">
                  {i.patients?.full_name}
                </Link>
              )}
              <span className={`block truncate text-sm ${patientId ? "font-medium text-ink" : "text-muted"}`}>{i.description}</span>
              <span className="block text-xs text-muted">{formatDate(i.issued_on)}</span>
            </span>
            <span className="text-right text-sm tabular-nums">
              <span className="block font-medium">{usd(i.amount_usd)}</span>
              {status === "partial" && <span className="block text-xs text-muted">{usd(d)} due</span>}
            </span>
            <Badge tone={INVOICE_STATUS[status].tone}>{INVOICE_STATUS[status].label}</Badge>
            <RowMenu
              items={[
                d > 0 && { kind: "dialog", label: "Record payment", title: `Payment for invoice #${i.number}`, content: <PaymentForm action={recordPayment.bind(null, i.id)} due={d} rate={rate} /> },
                { kind: "link", label: "Print invoice", href: `/print/invoice/${i.id}` },
                !i.voided_at && { kind: "dialog", label: "Void", danger: true, title: `Void invoice #${i.number}`, content: <VoidForm action={voidInvoice.bind(null, i.id)} /> },
              ]}
            />
          </li>
        );
      })}
    </ul>
  );
}
