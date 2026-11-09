"use server";

import { after } from "next/server";
import { notifyPayment } from "@/lib/whatsapp-events";
import { createClient } from "@/lib/supabase/server";
import { done } from "@/lib/done";
import { errorMessage, money, text, type ActionState } from "@/lib/action-result";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import type { PaymentMethod } from "@/lib/money";

const METHODS: PaymentMethod[] = ["cash_usd", "cash_lbp", "card", "transfer", "whish", "omt"];

export async function saveService(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const name = text(formData, "name");
  const duration = Number(text(formData, "duration_min"));
  const price = money(formData, "price_usd");
  if (name.length < 2) return { error: "Name the service." };
  if (!(duration >= 5 && duration <= 480)) return { error: "Duration must be 5 to 480 minutes." };
  if (Number.isNaN(price) || price < 0) return { error: "Enter a price in USD." };
  const supabase = await createClient();
  const row = { name, duration_min: Math.round(duration), price_usd: price };
  const { error } = id
    ? await supabase.from("services").update(row).eq("id", id)
    : await supabase.from("services").insert({ ...row, practice_id: membership.practiceId });
  return error ? { error: errorMessage(error, "Couldn't save.") } : done(id ? "Service saved" : "Service added");
}

export async function archiveService(id: string): Promise<ActionState> {
  await requireStaff(["owner"]);
  const { error } = await (await createClient()).from("services").update({ archived_at: new Date().toISOString() }).eq("id", id);
  return error ? { error: errorMessage(error) } : done("Service removed");
}

export async function savePackageType(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const name = text(formData, "name");
  const consultations = Number(text(formData, "consultations"));
  const days = Number(text(formData, "valid_days"));
  const price = money(formData, "price_usd");
  if (name.length < 2) return { error: "Name the package." };
  if (!(consultations >= 1 && consultations <= 200)) return { error: "Consultations must be 1 to 200." };
  if (!(days >= 1 && days <= 1095)) return { error: "Validity must be 1 to 1095 days." };
  if (Number.isNaN(price) || price < 0) return { error: "Enter a price in USD." };
  const supabase = await createClient();
  const row = { name, consultations: Math.round(consultations), valid_days: Math.round(days), price_usd: price };
  const { error } = id
    ? await supabase.from("package_types").update(row).eq("id", id)
    : await supabase.from("package_types").insert({ ...row, practice_id: membership.practiceId });
  return error ? { error: errorMessage(error, "Couldn't save.") } : done(id ? "Package saved" : "Package added");
}

export async function archivePackageType(id: string): Promise<ActionState> {
  await requireStaff(["owner"]);
  const { error } = await (await createClient()).from("package_types").update({ archived_at: new Date().toISOString() }).eq("id", id);
  return error ? { error: errorMessage(error) } : done("Package removed. Packages already sold are not affected.");
}

export async function sellPackage(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(BILLING_ROLES);
  const typeId = text(formData, "package_type_id");
  if (!typeId) return { error: "Choose a package." };
  const priceRaw = text(formData, "price_usd");
  const price = priceRaw ? money(formData, "price_usd") : undefined;
  if (price !== undefined && (Number.isNaN(price) || price < 0)) return { error: "Enter a valid price." };
  const { error } = await (await createClient()).rpc("sell_package", {
    p_patient_id: patientId,
    p_package_type_id: typeId,
    p_starts_on: text(formData, "starts_on") || undefined,
    p_price_usd: price,
  });
  return error ? { error: errorMessage(error, "Couldn't sell the package.") } : done("Package sold. Invoice created.");
}

export async function createInvoice(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(BILLING_ROLES);
  const description = text(formData, "description");
  const amount = money(formData, "amount_usd");
  if (!description) return { error: "Describe the charge." };
  if (Number.isNaN(amount) || amount <= 0) return { error: "Enter an amount in USD." };
  const { error } = await (await createClient()).rpc("create_invoice", { p_patient_id: patientId, p_description: description, p_amount_usd: amount });
  return error ? { error: errorMessage(error, "Couldn't create the invoice.") } : done("Invoice created");
}

export async function recordPayment(invoiceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(BILLING_ROLES);
  const method = text(formData, "method") as PaymentMethod;
  if (!METHODS.includes(method)) return { error: "Choose how they paid." };
  const lbpAmount = method === "cash_lbp" ? Number(text(formData, "lbp_amount").replace(/[,\s]/g, "")) : undefined;
  const usdAmount = method === "cash_lbp" ? undefined : money(formData, "amount_usd");
  if (method === "cash_lbp" && !(lbpAmount! > 0)) return { error: "Enter the amount in LBP." };
  if (method !== "cash_lbp" && (Number.isNaN(usdAmount) || !(usdAmount! > 0))) return { error: "Enter the amount in USD." };
  const { data: paymentId, error } = await (await createClient()).rpc("record_payment", {
    p_invoice_id: invoiceId,
    p_method: method,
    p_amount_usd: usdAmount,
    p_lbp_amount: lbpAmount,
    p_note: text(formData, "note"),
  });
  if (!error && paymentId) after(() => notifyPayment(paymentId));
  return error ? { error: errorMessage(error, "Couldn't record the payment.") } : done("Payment recorded");
}

export async function refundPayment(paymentId: string): Promise<ActionState> {
  await requireStaff(BILLING_ROLES);
  const { error } = await (await createClient()).rpc("refund_payment", { p_payment_id: paymentId });
  return error ? { error: errorMessage(error) } : done("Payment refunded");
}

export async function voidInvoice(invoiceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(BILLING_ROLES);
  const { error } = await (await createClient()).rpc("void_invoice", { p_invoice_id: invoiceId, p_reason: text(formData, "reason") });
  return error ? { error: errorMessage(error) } : done("Invoice voided");
}
