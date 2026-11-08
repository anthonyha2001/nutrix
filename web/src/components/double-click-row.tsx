"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// A list row that opens `href` on double-click anywhere in it. Buttons, links,
// menus and fields inside the row keep their own behaviour.
export function DoubleClickRow({ href, className = "", children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <li
      onMouseEnter={() => router.prefetch(href)}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role=menu], dialog")) return;
        window.getSelection()?.removeAllRanges();
        router.push(href);
      }}
      title="Double-click to open"
      className={`cursor-pointer select-none transition-colors hover:bg-canvas/60 ${className}`}
    >
      {children}
    </li>
  );
}
