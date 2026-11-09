"use client";

import { useActionState, useState } from "react";
import { showToast } from "@/components/toaster";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { saveWhatsAppSettings } from "./actions";

export function WhatsAppSettingsForm({ useOwn, hasOwnKeys, phoneNumberId, nutrixReady }: { useOwn: boolean; hasOwnKeys: boolean; phoneNumberId: string; nutrixReady: boolean }) {
  const [sender, setSender] = useState(useOwn ? "own" : "nutrix");
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await saveWhatsAppSettings(prev, fd);
    if (r.success) showToast(r.success);
    return r;
  }, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { id: "nutrix", title: "Nutrix number", hint: nutrixReady ? "Ready. Nothing to set up." : "Not available yet. Use your own number, or wait for Nutrix to connect it." },
          { id: "own", title: "My own WhatsApp number", hint: "Your WhatsApp Business API number and templates (Meta)." },
        ].map((o) => (
          <label key={o.id} className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-ink has-[:checked]:bg-canvas">
            <input type="radio" name="sender" value={o.id} checked={sender === o.id} onChange={() => setSender(o.id)} className="mt-1 accent-ink" />
            <span>
              <span className="block text-sm font-medium">{o.title}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {sender === "own" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number ID" hint="WhatsApp Manager, API setup.">
            <input name="phone_number_id" inputMode="numeric" defaultValue={phoneNumberId} className={inputClass} />
          </Field>
          <Field label="Access token" hint={hasOwnKeys ? "Leave empty to keep the saved token." : "A permanent system user token."}>
            <input name="token" type="password" autoComplete="off" className={inputClass} />
          </Field>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
