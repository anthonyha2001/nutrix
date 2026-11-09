"use client";

import { useTransition } from "react";
import { Send } from "lucide-react";
import { showToast } from "@/components/toaster";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

// Sends a message through the WhatsApp API.
export function SendWhatsApp({ action, label = "Send on WhatsApp", className = "" }: { action: () => Promise<ActionState>; label?: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (r.error) showToast(r.error, "error");
          else if (r.success) showToast(r.success);
        })
      }
      className={buttonClass("whatsapp", className)}
    >
      <Send className="size-4" /> {pending ? "Sending…" : label}
    </button>
  );
}
