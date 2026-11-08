"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { lbp, PAYMENT_METHODS, usd, type PaymentMethod } from "@/lib/money";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Submit({ pending, label, danger = false }: { pending: boolean; label: string; danger?: boolean }) {
  return (
    <div className="flex justify-end pt-1">
      <Button type="submit" disabled={pending} className={danger ? "bg-danger text-white hover:bg-danger/90" : ""}>
        {pending ? "Saving…" : label}
      </Button>
    </div>
  );
}

function Usd({ name, defaultValue, required = true }: { name: string; defaultValue?: number | string; required?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-muted">$</span>
      <input name={name} inputMode="decimal" required={required} defaultValue={defaultValue} className={`${inputClass} pl-8`} />
    </div>
  );
}

export function ServiceForm({ action, service }: { action: Action; service?: { name: string; duration_min: number; price_usd: number } }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name">
        <input name="name" required maxLength={80} defaultValue={service?.name} placeholder="e.g. First consultation" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Minutes">
          <input name="duration_min" type="number" min={5} max={480} step={5} required defaultValue={service?.duration_min ?? 45} className={inputClass} />
        </Field>
        <Field label="Price">
          <Usd name="price_usd" defaultValue={service?.price_usd} />
        </Field>
      </div>
      <Submit pending={pending} label={service ? "Save" : "Add service"} />
    </form>
  );
}

export function PackageTypeForm({ action, pkg }: { action: Action; pkg?: { name: string; consultations: number; price_usd: number; valid_days: number } }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name">
        <input name="name" required maxLength={80} defaultValue={pkg?.name} placeholder="e.g. 3-month program" className={inputClass} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Consultations">
          <input name="consultations" type="number" min={1} max={200} required defaultValue={pkg?.consultations ?? 4} className={inputClass} />
        </Field>
        <Field label="Valid for (days)">
          <input name="valid_days" type="number" min={1} max={1095} required defaultValue={pkg?.valid_days ?? 90} className={inputClass} />
        </Field>
        <Field label="Price">
          <Usd name="price_usd" defaultValue={pkg?.price_usd} />
        </Field>
      </div>
      <Submit pending={pending} label={pkg ? "Save" : "Add package"} />
    </form>
  );
}

export function SellPackageForm({
  action,
  types,
  today,
  defaultTypeId,
}: {
  action: Action;
  types: { id: string; name: string; consultations: number; price_usd: number; valid_days: number }[];
  today: string;
  // Renewing: the package the patient had.
  defaultTypeId?: string | null;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [typeId, setTypeId] = useState(types.find((t) => t.id === defaultTypeId)?.id ?? types[0]?.id ?? "");
  const t = types.find((x) => x.id === typeId);
  if (!types.length) return <p className="text-sm text-muted">No packages yet. The practice owner adds them in Billing, Catalogue.</p>;
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Package">
        <select name="package_type_id" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
          {types.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.consultations} consultations · {usd(x.price_usd)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts">
          <input name="starts_on" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Price" hint={t ? `Valid ${t.valid_days} days.` : undefined}>
          <Usd key={typeId} name="price_usd" defaultValue={t?.price_usd} />
        </Field>
      </div>
      <Submit pending={pending} label="Sell package" />
    </form>
  );
}

export function InvoiceForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Description">
        <input name="description" required maxLength={200} placeholder="e.g. Body composition analysis" className={inputClass} />
      </Field>
      <Field label="Amount">
        <Usd name="amount_usd" />
      </Field>
      <Submit pending={pending} label="Create invoice" />
    </form>
  );
}

export function PaymentForm({ action, due, rate }: { action: Action; due: number; rate: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [method, setMethod] = useState<PaymentMethod>("cash_usd");
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm text-muted">
        Due: <span className="font-semibold text-ink">{usd(due)}</span>
        {method === "cash_lbp" && ` = ${lbp(due * rate)} at ${rate.toLocaleString("en-US")}`}
      </p>
      <Field label="Method" group>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <label key={m.value} className="flex cursor-pointer items-center justify-center rounded-xl border border-line px-2 py-2.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-canvas has-[:checked]:font-medium">
              <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </div>
      </Field>
      {method === "cash_lbp" ? (
        <Field label="Amount in LBP">
          <input key="lbp" name="lbp_amount" inputMode="numeric" required defaultValue={Math.round(due * rate)} className={inputClass} />
        </Field>
      ) : (
        <Field label="Amount">
          <Usd key="usd" name="amount_usd" defaultValue={due} />
        </Field>
      )}
      <Field label="Note" optional>
        <input name="note" maxLength={200} className={inputClass} />
      </Field>
      <Submit pending={pending} label="Record payment" />
    </form>
  );
}

export function VoidForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm text-muted">The invoice keeps its number but owes nothing. A voided package invoice also cancels the package.</p>
      <Field label="Reason" optional>
        <input name="reason" maxLength={200} className={inputClass} />
      </Field>
      <Submit pending={pending} label="Void invoice" danger />
    </form>
  );
}
