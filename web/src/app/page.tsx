import type { Metadata } from "next";
import Link from "next/link";
import {
  Apple,
  ArrowRight,
  BellRing,
  BookCopy,
  CalendarDays,
  ChefHat,
  Droplet,
  FileText,
  Globe2,
  Languages,
  LineChart,
  Lock,
  MessageCircle,
  NotebookPen,
  Receipt,
  Repeat,
  ScanBarcode,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Stethoscope,
  UserRound,
  Weight,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { Reveal } from "@/components/reveal";
import { buttonClass, Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: { absolute: "Nutrix · The operating system for dietitians" },
  description: "Patient files, meal plans with live macros, Lebanese dishes, appointments, billing, automatic WhatsApp, and an Arabic and English app for your patients.",
};

const FEATURES = [
  {
    icon: UserRound,
    title: "Complete patient files",
    text: "History, allergies, measurements with weight charts, lab results, consultation notes and progress, in one calm screen.",
    span: "lg:col-span-2",
  },
  { icon: NotebookPen, title: "Meal plans with live macros", text: "Type a list or search, drag between meals and days. Calories, protein, carbs and fat update as you go." },
  { icon: Repeat, title: "Approved swaps", text: "Offer alternatives at the same energy. Patients pick, you stay in control." },
  { icon: BookCopy, title: "Private templates", text: "Meals, days, weeks and programs that are yours alone. Plans given to patients never change behind your back." },
  {
    icon: Apple,
    title: "7,000+ foods and Lebanese dishes",
    text: "USDA FoodData Central, regional products, barcodes, and recipes whose nutrition is computed from their ingredients.",
    span: "lg:col-span-2",
  },
  { icon: CalendarDays, title: "Appointments", text: "A week calendar, booking requests from the app, attendance, and a summary before every consultation." },
  { icon: Receipt, title: "Packages and billing", text: "Sell packages, take USD or LBP cash at your rate, Whish or OMT. Printable invoices and receipts." },
  { icon: Send, title: "Automatic WhatsApp", text: "Confirmations, reminders the day before, receipts and new plans, in each patient's language. From your number or ours." },
  { icon: MessageCircle, title: "Private messages", text: "One thread per patient, with unread counts. No personal WhatsApp groups to manage." },
  { icon: FileText, title: "Printable plans", text: "Plans and shopping lists printed in English, French or Arabic, ready to hand over." },
] as const;

const PATIENT = [
  { icon: Sparkles, title: "Today, at a glance", text: "What to eat, what they have eaten, and their next visit." },
  { icon: Check, title: "One-tap logging", text: "\"I ate this\" on any planned meal, with the swaps you approved." },
  { icon: Droplet, title: "Water and check-ins", text: "Mood, energy, hunger, sleep and how well they followed the plan." },
  { icon: ShoppingBasket, title: "Shopping list", text: "By aisle, with recipes turned into their ingredients." },
  { icon: ChefHat, title: "Recipes they can cook", text: "The ingredients behind every dish, for the exact portion." },
  { icon: BellRing, title: "Meal reminders", text: "A notification at each meal's time, on Android and iPhone." },
  { icon: Weight, title: "Progress", text: "Weight and measurements, from home or from your clinic." },
  { icon: Languages, title: "Arabic or English", text: "A complete Arabic interface, right to left, written by hand." },
] as const;

const DISHES = ["Tabbouleh", "Fattoush", "Hummus bi tahini", "Kibbeh bil saniyeh", "Mujaddara", "Warak enab", "Fatteh hummus", "Manoushe za'atar", "Kafta", "Shorbet adas"];

const TRUST = [
  { icon: Lock, title: "Clinical privacy by design", text: "Each dietitian sees only their own patients. Assistants handle booking and billing, never clinical files." },
  { icon: ShieldCheck, title: "Numbers you can trust", text: "Every calorie comes from the food database when you save. Nothing typed by hand, nothing guessed." },
  { icon: Stethoscope, title: "You stay the clinician", text: "Nutrix assists, it never diagnoses, prescribes or changes a plan on its own." },
] as const;

const STEPS = [
  { n: "1", title: "Open your practice", text: "Sign up, name your practice, invite your dietitians and assistant. Five minutes." },
  { n: "2", title: "Add your patients", text: "Their file, allergies and first measurements. They get the app with one invite." },
  { n: "3", title: "Plan, follow, grow", text: "Give plans in one step, see their diary between visits, and let reminders run themselves." },
] as const;

const NEXT = [
  { icon: LineChart, title: "Daily briefing", text: "Who needs you today: no logs for three days, missed check-ins, packages ending." },
  { icon: FileText, title: "Progress reports", text: "Branded PDFs of weight, composition and adherence, reviewed before sending." },
  { icon: Smartphone, title: "Smart scales", text: "Body composition from InBody, Tanita, Withings and Apple Health." },
  { icon: ScanBarcode, title: "Meal photos", text: "Patients photograph a meal, confirm the foods, and it is logged." },
] as const;

const FAQ = [
  ["Is it made for Lebanon?", "Yes. Lebanese dishes are built in, prices are in USD with LBP cash at your own rate, payments include Whish and OMT, and the patient app speaks Arabic."],
  ["Do my patients need to download anything?", "They open a link and add Nutrix to their home screen. It works on any phone, iPhone or Android, with no app store."],
  ["Can I use my own WhatsApp number?", "Yes. Messages can go out from the Nutrix number with nothing to set up, or from your own WhatsApp Business number."],
  ["Where do the nutrition numbers come from?", "From USDA FoodData Central and verified product data. Lebanese dishes are recipes whose values are computed from their ingredients, and you can adjust them."],
  ["Who can see a patient's file?", "The practice owner and the patient's dietitian. Assistants see contact details for booking and billing only. Patients see their own plan and progress."],
  ["Can I try it?", "Yes. Open the live demo: a private sample practice full of patients, plans and appointments, with no sign-up. Or create your practice and add your first patients today."],
] as const;

function Check(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo className="text-lg text-white" />
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#patients" className="hover:text-white">Patient app</a>
            <a href="#lebanon" className="hover:text-white">Lebanese food</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <Link href="/demo" className="hover:text-white">Demo</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden h-10 items-center rounded-lg px-3 text-sm text-white/80 hover:text-white sm:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-ink transition hover:bg-brand-strong active:scale-[0.97]">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div aria-hidden className="aurora pointer-events-none absolute -top-40 left-1/2 h-[42rem] w-[56rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(143_227_194/0.28),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-20 pb-24 lg:grid-cols-[1.05fr_1fr] lg:pt-28 lg:pb-32">
          <div>
            <p className="page-enter inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="size-1.5 rounded-full bg-brand" /> Built in Lebanon, for dietitians
            </p>
            <h1 className="page-enter mt-6 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] xl:text-[3.75rem]">
              The operating system
              <br />
              for <span className="bg-gradient-to-r from-brand to-[#c8f1e0] bg-clip-text text-transparent">dietitians.</span>
            </h1>
            <p className="page-enter mt-6 max-w-xl text-lg text-white/70">
              Patient files, meal plans with live macros, Lebanese dishes, appointments, billing and automatic WhatsApp, with an Arabic and English app your patients actually use between visits.
            </p>
            <div className="page-enter mt-9 flex flex-wrap gap-3">
              <Link href="/signup" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-ink transition hover:bg-brand-strong active:scale-[0.97]">
                Start your practice <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/demo" className="inline-flex h-12 items-center rounded-xl border border-white/15 px-6 font-medium text-white/90 transition hover:bg-white/5">
                Try the live demo
              </Link>
            </div>
            <div className="page-enter mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
              <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-brand" /> English and Arabic</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-brand" /> Any phone, no app store</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-brand" /> USD and LBP</span>
            </div>
          </div>

          {/* Product mock-ups */}
          <div className="relative mx-auto h-[30rem] w-full max-w-[34rem]">
            <div className="float absolute top-4 left-0 w-[88%] rounded-2xl border border-white/10 bg-surface p-5 text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Meal plan · Lina Khoury</p>
                  <p className="font-semibold">Mediterranean, 1,600 kcal</p>
                </div>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">Active</span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                {[
                  ["Energy", "1,584", "kcal", ""],
                  ["Protein", "98", "g", "bg-protein"],
                  ["Carbs", "176", "g", "bg-carbs"],
                  ["Fat", "54", "g", "bg-fat"],
                ].map(([l, v, u, c]) => (
                  <div key={l}>
                    <span className="flex items-center gap-1 text-muted">
                      {c && <span className={`size-1.5 rounded-full ${c}`} />}
                      {l}
                    </span>
                    <span className="text-base font-semibold tabular-nums">
                      {v}
                      <span className="ms-0.5 text-[10px] font-normal text-muted">{u}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="bar-grow mt-3 flex h-2 overflow-hidden rounded-full bg-line">
                <span className="bg-protein" style={{ width: "25%" }} />
                <span className="bg-carbs" style={{ width: "44%" }} />
                <span className="bg-fat" style={{ width: "31%" }} />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["Breakfast", "Labneh, whole-wheat pita, cucumber", "380"],
                  ["Lunch", "Tabbouleh, grilled chicken breast", "540"],
                  ["Snack", "Apple, 10 almonds", "160"],
                  ["Dinner", "Shorbet adas, fattoush", "504"],
                ].map(([m, f, k]) => (
                  <div key={m} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block text-xs text-muted">{m}</span>
                      <span className="block truncate">{f}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium tabular-nums">{k} kcal</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone: the patient app in Arabic */}
            <div dir="rtl" lang="ar" className="float-slow absolute -right-2 bottom-0 w-[13.5rem] rounded-[2.2rem] border-[6px] border-[#1d232c] bg-canvas p-3 text-ink shadow-[0_40px_80px_-25px_rgb(0_0_0/0.7)] sm:right-0">
              <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-line" />
              <p className="text-base font-semibold">مرحباً لينا</p>
              <p className="text-[11px] text-muted">برنامج البحر المتوسط</p>
              <div className="mt-3 rounded-2xl bg-surface p-3">
                <p className="text-[11px] font-medium">ما تناولته اليوم</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  920 <span className="text-[10px] font-normal text-muted">من أصل 1600 سعرة</span>
                </p>
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line">
                  <span className="bg-protein" style={{ width: "22%" }} />
                  <span className="bg-carbs" style={{ width: "20%" }} />
                  <span className="bg-fat" style={{ width: "16%" }} />
                </div>
              </div>
              <div className="mt-2 rounded-2xl bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium">الماء</p>
                  <p className="text-[10px] text-muted">1.25 من 2 ل</p>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Droplet key={i} className={`size-3.5 ${i < 5 ? "fill-sky-400 text-sky-500" : "text-line"}`} />
                  ))}
                </div>
              </div>
              <div className="mt-2 rounded-2xl bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold">الغداء</p>
                  <span className="rounded-md bg-brand px-1.5 py-0.5 text-[9px] font-semibold">تناولتها</span>
                </div>
                <p className="mt-1 text-[11px]">تبولة · صدر دجاج مشوي</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee strip */}
      <section aria-label="Highlights" className="overflow-hidden border-b border-line bg-surface py-5">
        <div className="marquee flex w-max gap-10 text-sm font-medium whitespace-nowrap text-muted">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-10" aria-hidden={k === 1 || undefined}>
              {["7,283 foods with measured nutrients", "Lebanese dishes computed from ingredients", "Arabic and English patient app", "Automatic WhatsApp in two languages", "USD, LBP cash, Whish and OMT", "Meal reminders on any phone", "Private templates for every dietitian", "Printable plans in three languages"].map((s) => (
                <span key={s} className="inline-flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-brand-strong" />
                  {s}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="scroll-mt-16 px-4 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-wide text-brand-strong uppercase">Everything in one place</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Replace the notebook, the spreadsheet and the WhatsApp groups.</h2>
            <p className="mt-4 text-lg text-muted">One system for the whole practice: clinical work, the calendar, the money and the conversation with your patients.</p>
          </Reveal>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className={"span" in f ? f.span : ""}>
                <div className="lift group h-full rounded-2xl border border-line bg-surface p-6 hover:border-ink/15">
                  <span className="grid size-11 place-items-center rounded-xl bg-canvas text-ink transition group-hover:bg-brand">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-muted">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Patient app */}
      <section id="patients" className="relative scroll-mt-16 overflow-hidden bg-ink px-4 py-24 text-white md:py-32">
        <div aria-hidden className="aurora pointer-events-none absolute right-[-20%] bottom-[-30%] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(143_227_194/0.18),transparent)]" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">For your patients</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">An app they open every day, not once a month.</h2>
            <p className="mt-4 text-lg text-white/65">Their plan, their diary and their progress, in Arabic or English. Every log they make shows up in your dashboard before the next visit.</p>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PATIENT.map((p, i) => (
              <Reveal key={p.title} delay={(i % 4) * 70}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/20 hover:bg-white/[0.07]">
                  <p.icon className="size-5 text-brand" />
                  <h3 className="mt-4 font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-white/60">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Lebanese food */}
      <section id="lebanon" className="scroll-mt-16 px-4 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide text-brand-strong uppercase">Made for Lebanese tables</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Tabbouleh is not a guess.</h2>
            <p className="mt-4 text-lg text-muted">
              Lebanese dishes are built as real recipes from measured ingredients, so their nutrition is computed, not invented. Copy any dish and adjust it to how your patients cook, and Nutrix recalculates everything.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {DISHES.map((d) => (
                <span key={d} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm">
                  {d}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-3xl border border-line bg-surface p-7 shadow-[0_30px_60px_-35px_rgb(13_17_23/0.35)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Lebanese dishes · 4 portions</p>
                  <p className="text-xl font-semibold">Tabbouleh</p>
                </div>
                <span className="text-end text-sm tabular-nums">
                  <span className="block text-2xl font-semibold">116</span>
                  <span className="text-muted">kcal per 100 g</span>
                </span>
              </div>
              <ul className="mt-6 divide-y divide-line text-sm">
                {[
                  ["Parsley, fresh", "150 g"],
                  ["Tomatoes, ripe", "200 g"],
                  ["Bulgur, fine, dry", "40 g"],
                  ["Olive oil", "40 g"],
                  ["Lemon juice", "45 g"],
                  ["Onion", "40 g"],
                  ["Fresh mint", "10 g"],
                ].map(([n, g]) => (
                  <li key={n} className="flex justify-between py-2.5">
                    <span>{n}</span>
                    <span className="text-muted tabular-nums">{g}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-canvas px-4 py-3 text-sm text-muted">
                <ChefHat className="size-4 shrink-0 text-brand-strong" /> Patients see these ingredients for their exact portion, so they can cook the same dish at home.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-line bg-surface px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
          {TRUST.map((t, i) => (
            <Reveal key={t.title} delay={i * 90}>
              <t.icon className="size-6 text-brand-strong" />
              <h3 className="mt-4 text-lg font-semibold">{t.title}</h3>
              <p className="mt-1.5 text-muted">{t.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-brand-strong uppercase">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Ready before your next consultation.</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="relative h-full overflow-hidden rounded-2xl border border-line bg-surface p-7">
                  <span aria-hidden className="absolute -top-6 -right-2 text-[7rem] leading-none font-semibold text-canvas">
                    {s.n}
                  </span>
                  <span className="relative grid size-10 place-items-center rounded-full bg-ink text-sm font-semibold text-brand">{s.n}</span>
                  <h3 className="relative mt-5 text-lg font-semibold">{s.title}</h3>
                  <p className="relative mt-1.5 text-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Coming next */}
      <section className="px-4 pb-24 md:pb-32">
        <div className="mx-auto max-w-6xl rounded-3xl bg-ink p-8 text-white md:p-12">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wide text-brand uppercase">Coming next</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">Already on the roadmap.</h2>
            </div>
            <p className="max-w-sm text-sm text-white/60">In development. Early practices help decide what comes first.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NEXT.map((n, i) => (
              <Reveal key={n.title} delay={i * 70}>
                <div className="h-full rounded-2xl border border-white/10 p-5">
                  <n.icon className="size-5 text-brand" />
                  <h3 className="mt-4 font-semibold">{n.title}</h3>
                  <p className="mt-1 text-sm text-white/60">{n.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 px-4 pb-24 md:pb-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Questions dietitians ask</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQ.map(([q, a], i) => (
              <Reveal key={q} delay={i * 50}>
                <details className="group rounded-2xl border border-line bg-surface px-5 py-4 transition open:shadow-[0_10px_30px_-20px_rgb(13_17_23/0.3)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-muted transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-muted">{a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="px-4 pb-24">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand px-8 py-16 text-center md:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.5),transparent)]" />
          <span className="relative mx-auto grid size-16 place-items-center rounded-[22%] bg-ink p-2.5 text-brand">
            <LogoMark className="size-full" />
          </span>
          <h2 className="relative mt-6 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">Give your practice the system it deserves.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-ink/70">Open your practice in minutes. Your patients get their app the same day.</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={buttonClass("primary", "h-12 rounded-xl px-7 text-base")}>
              Start your practice <ArrowRight className="size-4" />
            </Link>
            <Link href="/demo" className="inline-flex h-12 items-center rounded-xl border border-ink/15 px-6 font-medium text-ink hover:bg-ink/5">
              Try the live demo
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <Logo />
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="size-4" /> English · العربية
          </span>
          <span>Nutrition data: USDA FoodData Central (public domain).</span>
        </div>
      </footer>
    </div>
  );
}
