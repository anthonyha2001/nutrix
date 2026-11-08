"use client";

import { useTransition } from "react";
import { useDialogAction } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { setRollout } from "./actions";

type Option = { id: string; name: string };

export function RolloutSelect({ featureKey, rollout, label }: { featureKey: string; rollout: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`${label} rollout`}
      defaultValue={rollout}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        start(async () => {
          const r = await setRollout(featureKey, value);
          if (r.error) showToast(r.error, "error");
          else showToast(`${label}: ${value === "all" ? "everyone" : value === "lab" ? "lab only" : "off"}`);
        });
      }}
      className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
    >
      <option value="off">Off</option>
      <option value="lab">Lab only</option>
      <option value="all">Everyone</option>
    </select>
  );
}

export function OverrideForm({ action, practices }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; practices: Option[] }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Practice">
        <select name="practice_id" required className={inputClass}>
          {practices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-2 font-medium">For this practice</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="value" value="on" defaultChecked className="accent-ink" /> On, whatever the rollout
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="value" value="off" className="accent-ink" /> Off, whatever the rollout
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="value" value="default" className="accent-ink" /> Follow the rollout (remove the exception)
        </label>
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function OpenAsForm({ action, practices }: { action: (formData: FormData) => Promise<void>; practices: Option[] }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Practice">
        <select name="practice_id" required className={inputClass}>
          {practices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="As">
        <select name="role" className={inputClass}>
          <option value="owner">Owner</option>
          <option value="dietitian">Dietitian</option>
          <option value="assistant">Assistant</option>
        </select>
      </Field>
      <Button type="submit">Open</Button>
    </form>
  );
}
