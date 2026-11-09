import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, NotebookPen, Receipt, Smartphone, UserRound, Users } from "lucide-react";
import { Logo } from "@/components/ui";
import { StartDemoButton } from "./start-button";

export const metadata: Metadata = {
  title: "Try the live demo",
  description: "Try Nutrix with a sample practice: patients, meal plans, appointments, billing and the patient app in Arabic or English. No sign-up.",
};

const INSIDE = [
  { icon: Users, title: "12 patients", body: "Each with a file and a first weigh-in." },
  { icon: UserRound, title: "Lina's full file", body: "Six weeks of progress, notes, allergy and lab history." },
  { icon: NotebookPen, title: "A live meal plan", body: "Lebanese dishes, swaps, targets, and a private template." },
  { icon: CalendarDays, title: "Appointments", body: "Today, tomorrow, past visits and a patient request." },
  { icon: Receipt, title: "Billing", body: "A package paid in lira, invoices and Whish payments." },
  { icon: Smartphone, title: "The patient app", body: "Switch to Lina's phone at any time, in Arabic or English." },
] as const;

export default function DemoPage() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Logo className="text-lg text-white" />
          </Link>
          <Link href="/signup" className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-ink hover:bg-brand-strong">
            Get started
          </Link>
        </div>
      </header>
      <section className="relative overflow-hidden bg-ink px-4 pt-16 pb-20 text-center text-white">
        <div aria-hidden className="aurora pointer-events-none absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(143_227_194/0.22),transparent)]" />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">Live demo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Run a practice for a day.</h1>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Get your own sample practice in the real Nutrix, full of patients, plans and appointments. Click anything, change anything, and switch to your patient&apos;s phone whenever you like.
          </p>
          <div className="mx-auto mt-8 max-w-sm">
            <StartDemoButton />
          </div>
          <p className="mt-4 text-sm text-white/50">No sign-up. Private to you, deleted after 24 hours. No messages are sent.</p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-4 py-14">
        <h2 className="text-center text-2xl font-semibold tracking-tight">What&apos;s inside Cedar Nutrition</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INSIDE.map(({ icon: Icon, title, body }) => (
            <div key={title} className="lift flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted">{body}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
