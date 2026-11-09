"use client";

import { useState, useTransition } from "react";
import { ClipboardList } from "lucide-react";
import { Modal } from "@/components/dialog";
import { InviteShare } from "@/components/invite-share";
import { Alert, Button, buttonClass } from "@/components/ui";
import { SendWhatsApp } from "@/components/send-whatsapp";
import { sendIntakeAction } from "../../whatsapp/actions";
import { createIntakeLink } from "../actions";

// Creates (or reuses) the patient's intake link only when asked, then offers
// it to send automatically on WhatsApp, or to copy.
export function IntakeSend({ patientId, firstName, practiceName, phone, label = "Send intake form" }: { patientId: string; firstName: string; practiceName: string; phone: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ url?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const message = (url: string) =>
    `Hi ${firstName}, before your first visit at ${practiceName}, could you fill in this short form? It takes about 5 minutes and helps us prepare your plan.\n\n${url}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!link?.url) start(async () => setLink(await createIntakeLink(patientId)));
        }}
        className={buttonClass("secondary")}
      >
        <ClipboardList className="size-4" /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Intake form" description={`${firstName} answers health, habits and lifestyle questions before the first visit. Answers fill the file where it is still empty.`}>
        {pending && !link && <p className="text-sm text-muted">Preparing the link…</p>}
        {link?.error && <Alert tone="error">{link.error}</Alert>}
        {link?.url && (
          <div className="space-y-3">
            {phone && <SendWhatsApp action={() => sendIntakeAction(patientId, link.url!)} />}
            <InviteShare url={link.url} message={message(link.url)} />
            <p className="text-xs text-muted">The link works once and for 14 days. It shows only {firstName}&apos;s first name.</p>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
