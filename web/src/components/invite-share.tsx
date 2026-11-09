"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "@/components/ui";

// Copy buttons for a link and its message. Sending on WhatsApp happens through
// the API (SendWhatsApp).
export function InviteShare({ url, message, compact = false }: { url: string; message: string; phone?: string | null; compact?: boolean }) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  async function copy(what: "link" | "message") {
    await navigator.clipboard.writeText(what === "link" ? url : message);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("link")} className={buttonClass("secondary", compact ? "h-8 px-3 text-xs" : "")}>
          {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
        {!compact && (
          <button type="button" onClick={() => copy("message")} className={buttonClass("ghost")}>
            {copied === "message" ? "Message copied" : "Copy full message"}
          </button>
        )}
      </div>
      {!compact && <p className="break-all font-mono text-xs text-muted">{url}</p>}
    </div>
  );
}
