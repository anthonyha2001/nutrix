// Client-safe money helpers. Prices are in USD; LBP cash is converted at the practice rate.

export type PaymentMethod = "cash_usd" | "cash_lbp" | "card" | "transfer" | "whish" | "omt";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash_usd", label: "Cash (USD)" },
  { value: "cash_lbp", label: "Cash (LBP)" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Bank transfer" },
  { value: "whish", label: "Whish" },
  { value: "omt", label: "OMT" },
];

export const METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])) as Record<PaymentMethod, string>;

export function usd(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function lbp(value: number | string | null | undefined) {
  return `${Math.round(Number(value ?? 0)).toLocaleString("en-US")} LBP`;
}

export type InvoiceStatus = "paid" | "partial" | "unpaid" | "void";

export function invoiceStatus(amount: number, due: number, voided: boolean): InvoiceStatus {
  if (voided) return "void";
  if (due <= 0.005) return "paid";
  return due < amount ? "partial" : "unpaid";
}

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: "green" | "amber" | "red" | "gray" }> = {
  paid: { label: "Paid", tone: "green" },
  partial: { label: "Partly paid", tone: "amber" },
  unpaid: { label: "Unpaid", tone: "red" },
  void: { label: "Void", tone: "gray" },
};
