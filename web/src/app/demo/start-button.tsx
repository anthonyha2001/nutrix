"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { startDemo } from "./actions";

// Starts the demo; while the sample practice is built (a few seconds) the
// button shows the logo growing.
export function StartDemoButton() {
  const [state, action, pending] = useActionState(startDemo, {});
  return (
    <form action={action} className="space-y-3">
      <button
        disabled={pending}
        className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-brand text-lg font-semibold text-ink shadow-[0_18px_50px_-12px_rgb(143_227_194/0.55)] transition hover:bg-brand-strong disabled:cursor-wait"
      >
        {pending ? (
          <>
            <span className="grid size-8 place-items-center rounded-[22%] bg-ink p-1 text-brand">
              <LogoMark animated className="size-full" />
            </span>
            Setting up your practice…
          </>
        ) : (
          <>
            Start the demo <ArrowRight className="size-5 transition group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      {state.error && <p className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
