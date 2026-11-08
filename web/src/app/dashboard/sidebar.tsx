"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useRef, useState, type ReactNode } from "react";
import {
  Apple,
  BookCopy,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  MessageCircle,
  NotebookTabs,
  Receipt,
  Settings,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo, Skeleton } from "@/components/ui";
import type { ModuleIcon, NavSection } from "@/lib/modules";

const ICONS: Record<ModuleIcon, LucideIcon> = {
  overview: LayoutDashboard,
  patients: UserRound,
  plans: NotebookTabs,
  templates: BookCopy,
  foods: Apple,
  appointments: CalendarDays,
  messages: MessageCircle,
  billing: Receipt,
  reports: FileText,
  team: Users,
  settings: Settings,
};

export type NavItem = { href: string; label: string; icon: ModuleIcon; section: NavSection; badge?: number };

// Lets nav links (rendered in a server slot) close the mobile drawer.
const CloseDrawer = createContext<() => void>(() => {});

// Same shell as Gymix: fixed sidebar on desktop, slide-in drawer on mobile.
// `practice`, `nav` and `account` are server-rendered slots.
export function Sidebar({ practice, nav, account }: { practice: ReactNode; nav: ReactNode; account: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    setOpen(true);
    requestAnimationFrame(() => closeButton.current?.focus());
  };
  const close = () => {
    if (!open) return;
    setOpen(false);
    menuButton.current?.focus();
  };

  return (
    <CloseDrawer value={close}>
      <div className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b border-line bg-surface px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <button
          ref={menuButton}
          type="button"
          onClick={openMenu}
          aria-label="Open menu"
          aria-expanded={open}
          className="-ml-2 grid size-10 place-items-center rounded-lg text-ink hover:bg-canvas"
        >
          <Menu className="size-5" />
        </button>
        <Logo />
      </div>

      {open && <div aria-hidden className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={close} />}

      <aside
        onKeyDown={(e) => e.key === "Escape" && close()}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:shrink-0 md:translate-x-0 ${
          open ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <Link href="/dashboard" onClick={close}>
            <Logo />
          </Link>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-mr-2 grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="shrink-0 px-3 pt-4">{practice}</div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {nav}
        </nav>

        <div className="shrink-0 border-t border-line p-3">{account}</div>
      </aside>
    </CloseDrawer>
  );
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const close = use(CloseDrawer);

  return (
    <ul className="space-y-1">
      {items.map(({ href, label, icon, badge, section }, i) => {
        const Icon = ICONS[icon];
        // A small heading where a new group starts (the first group needs none).
        const heading = i > 0 && items[i - 1].section !== section ? section : null;
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <li key={href}>
            {heading && <p className="px-3 pt-4 pb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{heading}</p>}
            <Link
              href={href}
              prefetch
              onClick={close}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                active ? "bg-ink font-medium text-white" : "text-ink/80 hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon className={`size-[18px] ${active ? "text-brand" : "text-muted"}`} />
              <span className="flex-1">{label}</span>
              {badge !== undefined && (
                <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-semibold text-ink" aria-label={`${badge} new`}>
                  {badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NavSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}
