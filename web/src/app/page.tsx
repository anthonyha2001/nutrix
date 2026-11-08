import Link from "next/link";
import { CalendarDays, ClipboardList, LineChart, UserRound } from "lucide-react";
import { buttonClass, Card, Logo } from "@/components/ui";

const PILLARS = [
  { icon: UserRound, title: "Patient files", text: "History, allergies, measurements, notes and progress in one place." },
  { icon: ClipboardList, title: "Meal planning", text: "Plans with automatic macros, your private templates and Lebanese dishes." },
  { icon: CalendarDays, title: "Appointments and billing", text: "Calendar, packages, payments and balances." },
  { icon: LineChart, title: "Follow-ups", text: "A daily briefing of the patients who need you." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Logo className="text-lg" />
        <div className="flex gap-2">
          <Link href="/login" className={buttonClass("ghost")}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClass("primary")}>
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        <div className="page-enter max-w-2xl">
          <p className="inline-flex rounded-full bg-brand px-3 py-1 text-xs font-semibold">For dietitians</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">The operating system for your practice.</h1>
          <p className="mt-4 text-lg text-muted">
            Nutrix runs your patients, meal plans, appointments and follow-ups, with an app your patients use between visits.
          </p>
        </div>
        <div className="stagger mt-12 grid gap-3 sm:grid-cols-2">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-5">
              <span className="grid size-10 place-items-center rounded-lg bg-canvas">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
