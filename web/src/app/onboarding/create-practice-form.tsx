"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-result";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { createPractice } from "./actions";

export function CreatePracticeForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPractice, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Practice name">
        <input name="name" required minLength={2} maxLength={80} placeholder="e.g. Beirut Nutrition Clinic" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create my practice"}
      </Button>
    </form>
  );
}
