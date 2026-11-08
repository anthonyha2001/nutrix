"use client";

import { useActionState } from "react";
import { showToast } from "@/components/toaster";
import { SearchSelect } from "@/components/search-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { savePractice } from "./actions";

export function PracticeForm({ practice, timezones }: { practice: { name: string; timezone: string; lbp_rate: number }; timezones: string[] }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await savePractice(prev, fd);
    if (result.success) showToast(result.success);
    return result;
  }, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Practice name" hint="Shown to patients and, later, on reports.">
        <input name="name" required minLength={2} maxLength={80} defaultValue={practice.name} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone">
          <SearchSelect name="timezone" defaultValue={practice.timezone}>
            {timezones.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="LBP rate" hint="Lebanese pounds for 1 USD, for cash payments.">
          <input name="lbp_rate" inputMode="numeric" required defaultValue={practice.lbp_rate} className={inputClass} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
