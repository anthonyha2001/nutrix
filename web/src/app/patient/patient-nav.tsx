"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpenText, CalendarDays, ChevronRight, Grid2x2, House, MessageCircle, NotebookPen, TrendingUp, UserRound, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/dialog";
import { PATIENT_SCREENS, type PatientIcon } from "@/lib/patient-app";

const ICONS: Record<PatientIcon, LucideIcon> = {
  today: House,
  plan: BookOpenText,
  diary: NotebookPen,
  progress: TrendingUp,
  messages: MessageCircle,
  appointments: CalendarDays,
  profile: UserRound,
};


const isActive = (pathname: string, href: string) => (href === "/patient" ? pathname === href : pathname.startsWith(href));

// Bottom tab bar, same build as the Gymix member portal.
export function PatientNav({ unread = 0, hidden = [] }: { unread?: number; hidden?: string[] }) {
  const TABS = PATIENT_SCREENS.filter((s) => s.tab && !hidden.includes(s.href));
  const MORE = PATIENT_SCREENS.filter((s) => !s.tab && !hidden.includes(s.href));
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((t) => isActive(pathname, t.href));

  const tabClass = (active: boolean) =>
    `relative flex min-w-0 flex-col items-center justify-center gap-1 ${active ? "text-ink" : "text-muted hover:text-ink"}`;
  const iconWrap = (active: boolean) =>
    `grid h-8 w-12 place-items-center rounded-full transition-colors duration-200 ${active ? "nav-bounce bg-brand" : ""}`;
  const label = "w-full truncate text-center text-[11px] font-medium leading-none";

  return (
    <nav
      data-bottom-bar
      aria-label="Patient"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur"
    >
      <div className="mx-auto grid h-[4.25rem] max-w-3xl" style={{ gridTemplateColumns: `repeat(${TABS.length + 1}, minmax(0, 1fr))` }}>
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = ICONS[t.icon];
          return (
            <Link key={t.href} href={t.href} prefetch aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <span className={iconWrap(active)}>
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className={label}>{t.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={tabClass(moreActive)}>
          <span className={iconWrap(moreActive)}>
            <Grid2x2 className="size-5" strokeWidth={moreActive ? 2.25 : 1.75} />
          </span>
          <span className={label}>More</span>
          {unread > 0 && (
            <span className="absolute top-1.5 left-1/2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white" aria-label={`${unread} unread`}>
              {unread}
            </span>
          )}
        </button>
      </div>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" sheet>
        <ul className="-mx-2 space-y-1">
          {MORE.map((t) => {
            const Icon = ICONS[t.icon];
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  prefetch
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-canvas active:scale-[0.99]"
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${isActive(pathname, t.href) ? "bg-brand" : "bg-canvas"}`}>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.label}</span>
                    <span className="block text-sm text-muted">{t.summary}</span>
                  </span>
                  {t.icon === "messages" && unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white">{unread}</span>
                  )}
                  <ChevronRight className="size-4 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Modal>
    </nav>
  );
}
