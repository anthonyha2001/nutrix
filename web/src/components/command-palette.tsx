"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Apple, BookCopy, CornerDownLeft, Loader2, Search, Stethoscope, UserRound, NotebookTabs, ArrowRight } from "lucide-react";
import { quickFind, type FindHit } from "@/app/dashboard/quick-find";

type Page = { href: string; label: string };
type Row = { key: string; title: string; detail?: string; href: string; icon: React.ReactNode; group: string };

// Read in the browser only, so the server render and hydration agree.
const useIsMac = () => useSyncExternalStore(() => () => {}, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);

// Ctrl+K (Cmd+K on a Mac) from anywhere in the dashboard: jump to a patient,
// start their plan or consultation, open a food or template, or go to a page.
export function CommandPalette({ pages, clinical }: { pages: Page[]; clinical: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ q: string; list: FindHit[] }>({ q: "", list: [] });
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const mac = useIsMac();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) {
      el.showModal();
      requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && el?.open) el.close();
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(() => start(async () => {
      const list = await quickFind(q);
      if (id === seq.current) setHits({ q, list });
    }), 150);
    return () => clearTimeout(t);
  }, [query]);

  const q = query.trim().toLowerCase();
  const found = q.length >= 2 && hits.q === query.trim() ? hits.list : [];
  const rows: Row[] = [];
  for (const h of found) {
    if (h.kind === "patient") {
      rows.push({ key: `p${h.id}`, title: h.title, detail: h.detail, href: h.href, icon: <UserRound className="size-4" />, group: "Patients" });
      if (clinical) {
        rows.push({ key: `c${h.id}`, title: `Consultation with ${h.title.split(" ")[0]}`, href: `${h.href}/consult`, icon: <Stethoscope className="size-4" />, group: "Patients" });
        rows.push({ key: `m${h.id}`, title: `New meal plan for ${h.title.split(" ")[0]}`, href: `${h.href}?tab=plans&plan=new`, icon: <NotebookTabs className="size-4" />, group: "Patients" });
      }
    }
  }
  // Only the best patient gets its shortcuts; the others are plain rows.
  const firstPatient = rows.findIndex((r) => r.key.startsWith("p"));
  const trimmed = rows.filter((r, i) => r.key.startsWith("p") || (i > firstPatient && i <= firstPatient + 2));
  for (const h of found) {
    if (h.kind === "food") trimmed.push({ key: `f${h.id}`, title: h.title, detail: h.detail, href: h.href, icon: <Apple className="size-4" />, group: "Foods" });
    if (h.kind === "template") trimmed.push({ key: `t${h.id}`, title: h.title, detail: h.detail, href: h.href, icon: <BookCopy className="size-4" />, group: "Templates" });
  }
  for (const p of pages) {
    if (!q || p.label.toLowerCase().includes(q)) trimmed.push({ key: `g${p.href}`, title: p.label, href: p.href, icon: <ArrowRight className="size-4" />, group: "Go to" });
  }
  const current = Math.min(active, Math.max(0, trimmed.length - 1));

  function go(row: Row | undefined) {
    if (!row) return;
    setOpen(false);
    setQuery("");
    router.push(row.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted hover:border-ink/25 hover:text-ink"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="hidden rounded border border-line bg-canvas px-1.5 text-[11px] font-medium md:inline">{mac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        aria-label="Search"
        className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, trimmed.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(trimmed[current]);
              }
            }}
            placeholder={clinical ? "Patient, food, template or page" : "Patient or page"}
            aria-label="Search"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
          {pending && <Loader2 className="size-4 animate-spin text-muted" />}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-2" role="listbox">
          {trimmed.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{q.length >= 2 && !pending ? `Nothing matches "${query.trim()}".` : "Type a name to search."}</li>}
          {trimmed.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === current}>
              {(i === 0 || trimmed[i - 1].group !== r.group) && <p className="px-4 pt-2 pb-1 text-xs font-medium tracking-wide text-muted uppercase">{r.group}</p>}
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === current ? "bg-canvas" : ""} ${r.key.startsWith("c") || r.key.startsWith("m") ? "pl-10" : ""}`}
              >
                <span className="text-muted">{r.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  {r.detail && <span className="block truncate text-xs text-muted">{r.detail}</span>}
                </span>
                {i === current && <CornerDownLeft className="size-3.5 text-muted" />}
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
