"use client";

import { useActionState, useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Alert, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

export type ChatMessage = { id: string; from_patient: boolean; body: string; created_at: string; read_at: string | null; sender?: string | null };

// One conversation. `asPatient` decides which side is "mine".
export function ChatThread({
  messages,
  asPatient,
  otherName,
  timeZone,
  action,
  tall = false,
}: {
  messages: ChatMessage[];
  asPatient: boolean;
  otherName: string;
  timeZone: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  tall?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [state, send, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.success) formRef.current?.reset();
    return r;
  }, {});

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
  const lastMine = [...messages].reverse().find((m) => m.from_patient === asPatient);

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface">
      <AutoRefresh seconds={5} />
      <div className={`${tall ? "h-[calc(100dvh-16rem)]" : "max-h-[60vh] min-h-72"} space-y-2 overflow-y-auto p-4`} aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Write to {otherName}.</p>}
        {messages.map((m) => {
          const mine = m.from_patient === asPatient;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm bg-canvas text-ink"}`}>
                {!mine && m.sender && !m.from_patient && <p className="mb-0.5 text-[11px] font-semibold text-muted">{m.sender}</p>}
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "text-white/60" : "text-muted"}`}>
                  {when(m.created_at)}
                  {mine && m.id === lastMine?.id && m.read_at ? " · Seen" : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {state.error && (
        <div className="px-3">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      <form ref={formRef} action={send} className="flex gap-2 border-t border-line p-3">
        <input name="body" required maxLength={4000} autoComplete="off" placeholder={`Message ${otherName}`} aria-label="Message" className={inputClass} />
        <button type="submit" disabled={pending} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white transition hover:bg-ink/85 disabled:opacity-50">
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </div>
  );
}
