"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { waNumber, whatsappUrl } from "@/lib/invite-link";
import type { PreparedMessage } from "@/lib/whatsapp-messages";

// Pick a prepared message, adjust it, and open it in WhatsApp.
export function WhatsAppComposer({ messages, phone }: { messages: PreparedMessage[]; phone: string | null }) {
  const [id, setId] = useState(messages[0]?.id);
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(messages.map((m) => [m.id, m.text])));
  const text = id ? texts[id] : "";
  const hasNumber = Boolean(waNumber(phone));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Message">
        {messages.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={id === m.id}
            onClick={() => setId(m.id)}
            className={`h-8 rounded-lg px-3 text-xs font-medium ${id === m.id ? "bg-ink text-white" : "bg-canvas text-ink/80 hover:text-ink"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => id && setTexts((t) => ({ ...t, [id]: e.target.value }))}
        rows={7}
        maxLength={2000}
        aria-label="Message"
        className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-brand/40"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{hasNumber ? `Opens WhatsApp with this message to ${phone}.` : "No phone number in the file: WhatsApp will ask who to send it to."}</p>
        <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" className={buttonClass("whatsapp")}>
          <MessageCircle className="size-4" /> Open in WhatsApp
        </a>
      </div>
    </div>
  );
}
