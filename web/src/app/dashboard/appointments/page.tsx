import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Video } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { PageTabs, TabPanel } from "@/components/page-tabs";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { clinicians } from "@/lib/practice";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, APPOINTMENT_STATUS, dayLabel, formatTime, formatWhen, isoToLocal, localToIso, weekStart } from "@/lib/time";
import { bookAppointment } from "./actions";
import { AppointmentDetail } from "./appointment-detail";
import { AppointmentBlock, CalendarInteractions, DaySlots } from "./calendar-interactions";
import { BookForm } from "./forms";

export const metadata: Metadata = { title: "Appointments" };

const TABS = ["week", "requests", "upcoming"] as const;
const START_HOUR = 8;
const END_HOUR = 21;
const HOUR_PX = 56;

const TONE_CLASS: Record<string, string> = {
  requested: "border-amber-300 bg-amber-50 text-amber-900",
  confirmed: "border-sky-200 bg-sky-50 text-sky-900",
  completed: "border-success/30 bg-success-soft text-success",
  no_show: "border-danger/30 bg-danger-soft text-danger",
  cancelled: "border-line bg-canvas text-muted line-through",
};

export default async function AppointmentsPage({ searchParams }: PageProps<"/dashboard/appointments">) {
  const { membership } = await requireStaff();
  const sp = await searchParams;
  const tz = membership.timezone;
  const today = todayIn(tz);
  const monday = weekStart(typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const canChooseDietitian = membership.role !== "dietitian";
  const dietitianFilter = typeof sp.d === "string" ? sp.d : "";

  const supabase = await createClient();
  let weekQuery = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, online, patient_id, dietitian_id, patients(full_name), services(name)")
    .gte("starts_at", localToIso(monday, "00:00", tz))
    .lt("starts_at", localToIso(addDays(monday, 7), "00:00", tz))
    .order("starts_at");
  if (dietitianFilter) weekQuery = weekQuery.eq("dietitian_id", dietitianFilter);

  const [{ data: week }, { data: requests }, { data: upcoming }, { data: patients }, { data: services }, team] = await Promise.all([
    weekQuery,
    supabase.from("appointments").select("id, starts_at, patient_note, patients(full_name)").eq("status", "requested").order("starts_at"),
    supabase
      .from("appointments")
      .select("id, starts_at, status, online, patients(full_name), services(name), dietitian:profiles!appointments_dietitian_id_fkey(full_name)")
      .in("status", ["requested", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(100),
    supabase.from("patients").select("id, full_name").eq("practice_id", membership.practiceId).is("archived_at", null).order("full_name"),
    supabase.from("services").select("id, name, duration_min, price_usd").eq("practice_id", membership.practiceId).is("archived_at", null).order("name"),
    canChooseDietitian ? clinicians(membership.practiceId) : Promise.resolve([]),
  ]);

  const tab = TABS.includes(sp.tab as (typeof TABS)[number]) ? (sp.tab as string) : "week";
  const link = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ tab, week: monday, ...(dietitianFilter ? { d: dietitianFilter } : {}), ...extra });
    return `/dashboard/appointments?${p}`;
  };
  const apptId = typeof sp.appt === "string" ? sp.appt : null;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description={membership.role === "dietitian" ? "Your consultations." : "The practice calendar."}
        action={
          <Dialog label="Book" icon={<Plus className="size-4" />} title="Book an appointment">
            <BookForm
              action={bookAppointment}
              patients={(patients ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
              services={(services ?? []).map((s) => ({ ...s, price_usd: Number(s.price_usd) }))}
              dietitians={team}
              defaults={{ date: today < monday || today > addDays(monday, 6) ? monday : today, time: "10:00" }}
            />
          </Dialog>
        }
      />

      <PageTabs
        instant
        base={`/dashboard/appointments?week=${monday}${dietitianFilter ? `&d=${dietitianFilter}` : ""}`}
        active={tab}
        tabs={[
          { id: "week", label: "Week" },
          { id: "requests", label: "Requests", count: requests?.length },
          { id: "upcoming", label: "Upcoming" },
        ]}
      />

      <TabPanel id="week" tabs={TABS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Link href={link({ week: addDays(monday, -7) })} aria-label="Previous week" className={buttonClass("ghost", "px-2")}>
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={link({ week: weekStart(today) })} className={buttonClass("secondary", "h-9")}>
              This week
            </Link>
            <Link href={link({ week: addDays(monday, 7) })} aria-label="Next week" className={buttonClass("ghost", "px-2")}>
              <ChevronRight className="size-5" />
            </Link>
            <span className="ml-2 text-sm font-medium">
              {dayLabel(monday)} to {dayLabel(addDays(monday, 6))}
            </span>
          </div>
          {canChooseDietitian && team.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <Link href={link({ d: "" }).replace("&d=", "")} className={`rounded-lg px-3 py-1.5 text-sm ${!dietitianFilter ? "bg-ink text-white" : "text-muted hover:bg-surface"}`}>
                Everyone
              </Link>
              {team.map((t) => (
                <Link key={t.id} href={link({ d: t.id })} className={`rounded-lg px-3 py-1.5 text-sm ${dietitianFilter === t.id ? "bg-ink text-white" : "text-muted hover:bg-surface"}`}>
                  {t.name.split(" ")[0]}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Card className="mt-4 overflow-x-auto">
          <CalendarInteractions
            grid={{ startHour: START_HOUR, endHour: END_HOUR, hourPx: HOUR_PX }}
            patients={(patients ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
            services={(services ?? []).map((s) => ({ ...s, price_usd: Number(s.price_usd) }))}
            dietitians={team}
            dietitianId={dietitianFilter || undefined}
          >
          <div className="grid min-w-[860px]" style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}>
            <div className="border-b border-line" />
            {days.map((d) => (
              <div key={d} className={`border-b border-l border-line px-2 py-2.5 text-center text-sm ${d === today ? "font-semibold text-ink" : "text-muted"}`}>
                {dayLabel(d)}
              </div>
            ))}
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular-nums" style={{ top: i * HOUR_PX }}>
                  {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
            {days.map((d) => (
              <div key={d} className={`relative border-l border-line ${d === today ? "bg-brand/5" : ""}`} style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h, i) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />
                ))}
                <DaySlots date={d} />
                {(week ?? [])
                  .filter((a) => isoToLocal(a.starts_at, tz).date === d)
                  .map((a) => {
                    const s = isoToLocal(a.starts_at, tz).minutes;
                    const e = s + (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000;
                    const top = Math.max(0, ((s - START_HOUR * 60) / 60) * HOUR_PX);
                    const height = Math.max(22, ((Math.min(e, END_HOUR * 60) - Math.max(s, START_HOUR * 60)) / 60) * HOUR_PX - 2);
                    return (
                      <AppointmentBlock
                        key={a.id}
                        href={link({ appt: a.id })}
                        movable={a.status === "confirmed" || a.status === "requested"}
                        moving={{ id: a.id, name: a.patients?.full_name ?? "this appointment", minutes: Math.round(e - s) }}
                        className={`absolute inset-x-1 z-10 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight transition hover:shadow-md ${TONE_CLASS[a.status]}`}
                        style={{ top, height }}
                      >
                        <span className="block font-semibold">{formatTime(a.starts_at, tz)}</span>
                        <span className="block truncate">{a.patients?.full_name}</span>
                        {a.online && <Video className="absolute top-1 right-1 size-3" aria-label="Online" />}
                      </AppointmentBlock>
                    );
                  })}
              </div>
            ))}
          </div>
          </CalendarInteractions>
        </Card>
        <p className="mt-2 text-xs text-muted">Click an empty time to book it, or drag an appointment to move it. Times in {tz.replace(/_/g, " ")}. Appointments outside {START_HOUR}:00 to {END_HOUR}:00 are in Upcoming.</p>
      </TabPanel>

      <TabPanel id="requests" tabs={TABS}>
        <Card>
          {!requests?.length ? (
            <EmptyState>
              <span className="block pt-5">No requests. Patients can ask for a time from their app.</span>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={link({ appt: r.id })} scroll={false} className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/60">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.patients?.full_name}</span>
                      <span className="block truncate text-sm text-muted">
                        Asks for {formatWhen(r.starts_at, tz)}
                        {r.patient_note ? ` · "${r.patient_note}"` : ""}
                      </span>
                    </span>
                    <Badge tone="amber">Requested</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </TabPanel>

      <TabPanel id="upcoming" tabs={TABS}>
        <Card>
          {!upcoming?.length ? (
            <EmptyState>
              <span className="block pt-5">Nothing booked.</span>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={link({ appt: a.id })} scroll={false} className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/60">
                    <span className="w-36 shrink-0 text-sm font-medium tabular-nums">{formatWhen(a.starts_at, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.patients?.full_name}</span>
                      <span className="block truncate text-sm text-muted">
                        {[a.services?.name, a.dietitian?.full_name, a.online ? "Online" : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Badge tone={APPOINTMENT_STATUS[a.status].tone}>{APPOINTMENT_STATUS[a.status].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </TabPanel>

      {apptId && <AppointmentDetail id={apptId} membership={membership} />}
    </div>
  );
}
