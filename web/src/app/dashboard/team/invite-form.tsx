"use client";

import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { inviteStaff } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useDialogAction(inviteStaff, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email" hint="They sign up (or log in) with this email and join automatically.">
        <input name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Role" group>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "dietitian", label: "Dietitian", hint: "Their own patients: plans, notes, measurements." },
            { value: "assistant", label: "Assistant", hint: "Patient contacts, booking and billing. No clinical data." },
          ].map((r) => (
            <label key={r.value} className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-ink has-[:checked]:bg-canvas">
              <input type="radio" name="role" value={r.value} defaultChecked={r.value === "dietitian"} className="mt-1 accent-ink" />
              <span>
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </div>
    </form>
  );
}
