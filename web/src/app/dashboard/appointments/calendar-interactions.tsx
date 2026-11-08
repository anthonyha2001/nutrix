"use client";

import { createContext, use, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/confirm";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import type { ActionState } from "@/lib/action-result";
import { dayLabel } from "@/lib/time";
import { bookAppointment, rescheduleAppointment } from "./actions";
import { BookForm } from "./forms";

type Option = { id: string; name: string };
type Service = { id: string; name: string; duration_min: number; price_usd: number };
type Grid = { startHour: number; endHour: number; hourPx: number };

// Drag payload for moving an appointment.
const DRAG_TYPE = "application/x-nutrix-appointment";
type Moving = { id: string; name: string; minutes: number };

const SNAP = 15; // minutes

type Ctx = Grid & {
  book: (date: string, time: string) => void;
  move: (m: Moving, date: string, time: string) => void;
  moving: boolean;
};
const CalendarCtx = createContext<Ctx | null>(null);

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// Wraps the week grid: clicking an empty time opens Book with that day and
// time; dropping an appointment on a time moves it (after a confirmation).
export function CalendarInteractions({
  children,
  grid,
  patients,
  services,
  dietitians,
  dietitianId,
}: {
  children: ReactNode;
  grid: Grid;
  patients: Option[];
  services: Service[];
  dietitians: Option[];
  // The dietitian the calendar is filtered to, if any: new bookings go to them.
  dietitianId?: string;
}) {
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const [confirmDialog, confirm] = useConfirm();
  const [moving, startMove] = useTransition();

  const move = async (m: Moving, date: string, time: string) => {
    if (!(await confirm(`Move ${m.name} to ${dayLabel(date)} at ${time}?`, { confirmLabel: "Move" }))) return;
    startMove(async () => {
      const fd = new FormData();
      fd.set("date", date);
      fd.set("time", time);
      fd.set("duration_min", String(m.minutes));
      const r: ActionState = await rescheduleAppointment(m.id, {}, fd);
      if (r.error) showToast(r.error, "error");
      else if (r.success) showToast(r.success);
    });
  };

  return (
    <CalendarCtx value={{ ...grid, book: (date, time) => setSlot({ date, time }), move, moving }}>
      {children}
      <Modal open={slot !== null} onClose={() => setSlot(null)} title="Book an appointment" description={slot ? `${dayLabel(slot.date)} at ${slot.time}` : undefined}>
        {slot && (
          <BookForm
            key={`${slot.date}${slot.time}`}
            action={bookAppointment}
            patients={patients}
            services={services}
            dietitians={dietitians}
            defaults={{ date: slot.date, time: slot.time, dietitianId }}
          />
        )}
      </Modal>
      {confirmDialog}
    </CalendarCtx>
  );
}

// The clickable, droppable background of one day column.
export function DaySlots({ date }: { date: string }) {
  const ctx = use(CalendarCtx);
  const [hover, setHover] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  if (!ctx) return null;
  const { startHour, endHour, hourPx } = ctx;

  // Minutes since midnight under the pointer, snapped to 15 minutes.
  const minuteAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const raw = startHour * 60 + (y / hourPx) * 60;
    const snapped = Math.floor(raw / SNAP) * SNAP;
    return Math.min(Math.max(snapped, startHour * 60), endHour * 60 - SNAP);
  };
  const topOf = (minutes: number) => ((minutes - startHour * 60) / 60) * hourPx;
  const marker = dropAt ?? hover;

  return (
    <div
      className={`absolute inset-0 ${ctx.moving ? "cursor-progress" : "cursor-pointer"}`}
      onMouseMove={(e) => setHover(minuteAt(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => ctx.book(date, hhmm(minuteAt(e)))}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropAt(minuteAt(e));
      }}
      onDragLeave={() => setDropAt(null)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(DRAG_TYPE);
        setDropAt(null);
        if (!raw) return;
        e.preventDefault();
        ctx.move(JSON.parse(raw) as Moving, date, hhmm(minuteAt(e)));
      }}
    >
      {marker !== null && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-1 rounded-md border border-dashed px-1.5 py-0.5 text-[11px] font-medium ${dropAt !== null ? "border-ink bg-ink/5 text-ink" : "border-brand-strong/50 bg-brand/10 text-brand-strong"}`}
          style={{ top: topOf(marker), height: (30 / 60) * hourPx - 2 }}
        >
          {dropAt !== null ? `Move to ${hhmm(marker)}` : `+ ${hhmm(marker)}`}
        </div>
      )}
    </div>
  );
}

// An appointment block; confirmed and requested ones can be dragged to a new time.
export function AppointmentBlock({
  href,
  movable,
  moving,
  className,
  style,
  children,
}: {
  href: string;
  movable: boolean;
  moving: Moving;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(moving));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => e.stopPropagation()}
      title={movable ? "Open, or drag to move" : undefined}
      className={`${className} ${movable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={style}
    >
      {children}
    </Link>
  );
}
