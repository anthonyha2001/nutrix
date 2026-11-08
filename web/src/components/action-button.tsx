"use client";

import { useTransition, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { showToast } from "@/components/toaster";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

// A button that runs a server action, with an optional custom confirmation.
export function ActionButton({
  action,
  children,
  confirm: question,
  danger = false,
  variant = "secondary",
  className = "",
}: {
  action: () => Promise<ActionState | void>;
  children: ReactNode;
  confirm?: string;
  danger?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [dialog, confirm] = useConfirm();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (question && !(await confirm(question, { danger, confirmLabel: typeof children === "string" ? children : undefined }))) return;
          start(async () => {
            const r = await action();
            if (r?.error) showToast(r.error, "error");
            else if (r?.success) showToast(r.success);
          });
        }}
        className={buttonClass(variant, className)}
      >
        {children}
      </button>
      {dialog}
    </>
  );
}
