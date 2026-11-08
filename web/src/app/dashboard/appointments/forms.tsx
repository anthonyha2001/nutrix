"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { SearchSelect } from "@/components/search-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { usd } from "@/lib/money";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; name: string };
type Service = { id: string; name: string; duration_min: number; price_usd: number };

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="flex justify-end pt-1">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
    </div>
  );
}

export function BookForm({
  action,
  patients,
  services,
  dietitians,
  defaults,
}: {
  action: Action;
  patients: Option[];
  services: Service[];
  // Shown to owners and assistants; empty for a dietitian (books for themselves).
  dietitians: Option[];
  defaults: { date: string; time: string; patientId?: string };
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Patient">
        <SearchSelect name="patient_id" required defaultValue={defaults.patientId ?? ""}>
          <option value="" disabled>
            Choose a patient
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SearchSelect>
      </Field>
      {services.length > 0 && (
        <Field label="Service">
          <select name="service_id" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={inputClass}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration_min} min · {usd(s.price_usd)}
              </option>
            ))}
            <option value="">Other</option>
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Date">
          <input name="date" type="date" required defaultValue={defaults.date} className={inputClass} />
        </Field>
        <Field label="Time">
          <input name="time" type="time" required step={300} defaultValue={defaults.time} className={inputClass} />
        </Field>
        <Field label="Minutes">
          <input key={serviceId} name="duration_min" type="number" min={5} max={480} step={5} defaultValue={service?.duration_min ?? 45} className={inputClass} />
        </Field>
      </div>
      {dietitians.length > 0 && (
        <Field label="Dietitian" hint="Leave as is to use the patient's dietitian.">
          <select name="dietitian_id" defaultValue="" className={inputClass}>
            <option value="">Patient&apos;s dietitian</option>
            {dietitians.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="online" className="accent-ink" /> Online consultation
      </label>
      <Field label="Note" optional hint="Practice note, e.g. bring last blood test.">
        <input name="note" maxLength={500} className={inputClass} />
      </Field>
      <Submit pending={pending} label="Book" />
    </form>
  );
}

export function RescheduleForm({ action, date, time, duration }: { action: Action; date: string; time: string; duration: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid grid-cols-3 gap-4">
        <Field label="Date">
          <input name="date" type="date" required defaultValue={date} className={inputClass} />
        </Field>
        <Field label="Time">
          <input name="time" type="time" required step={300} defaultValue={time} className={inputClass} />
        </Field>
        <Field label="Minutes">
          <input name="duration_min" type="number" min={5} max={480} step={5} defaultValue={duration} className={inputClass} />
        </Field>
      </div>
      <Submit pending={pending} label="Move" />
    </form>
  );
}

export function CancelForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Reason" optional>
        <input name="reason" maxLength={300} placeholder="e.g. Patient travelling" className={inputClass} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="bg-danger text-white hover:bg-danger/90">
          {pending ? "Cancelling…" : "Cancel appointment"}
        </Button>
      </div>
    </form>
  );
}
