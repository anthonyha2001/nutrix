import { BILLING_ROLES, CLINICAL_ROLES, OWNER_ONLY, type PracticeRole } from "@/lib/roles";

// Every module of Nutrix Professional in one place: the sidebar, each page's
// placeholder and the README roadmap all read from this list. Icons are named
// (not components) so the list can cross from server to client.

export type ModuleIcon =
  | "overview"
  | "patients"
  | "plans"
  | "templates"
  | "foods"
  | "appointments"
  | "messages"
  | "billing"
  | "reports"
  | "team"
  | "settings";

export type Phase = 1 | 2 | 3 | 4;

export const PHASE_LABELS: Record<Phase, string> = {
  1: "Phase 1 · Core practice",
  2: "Phase 2 · Appointments and business",
  3: "Phase 3 · Follow-ups, devices and reports",
  4: "Phase 4 · Food intelligence",
};

export type Module = {
  href: string;
  label: string;
  icon: ModuleIcon;
  phase: Phase;
  summary: string;
  planned: string[];
  roles?: PracticeRole[];
};

export const MODULES: Module[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: "overview",
    phase: 1,
    summary: "Your day at a glance and the patients who need you.",
    planned: [
      "Active patients, upcoming appointments and revenue",
      "Daily briefing: who needs attention and why",
      "Recent food diary activity and progress indicators",
    ],
  },
  {
    href: "/dashboard/patients",
    label: "Patients",
    icon: "patients",
    phase: 1,
    summary: "Complete patient files, from history to progress photos.",
    planned: [
      "Personal details, medical and nutritional history",
      "Allergies and intolerances, checked against every plan",
      "Body measurements, composition and weight history",
      "Current and previous meal plans, food diary",
      "Consultation notes, appointment history, progress photos",
    ],
  },
  {
    href: "/dashboard/meal-plans",
    label: "Meal plans",
    icon: "plans",
    phase: 1,
    roles: CLINICAL_ROLES,
    summary: "Build plans with automatic calorie and macro totals.",
    planned: [
      "Breakfast, lunch, dinner and snacks",
      "Food search, quantities and servings",
      "Automatic calories, protein, carbs and fat",
      "Substitutions approved by the dietitian",
      "Assigned plans are snapshots: editing a template never changes them",
    ],
  },
  {
    href: "/dashboard/templates",
    label: "Templates",
    icon: "templates",
    phase: 1,
    roles: CLINICAL_ROLES,
    summary: "Your private library of meals, days, weeks and programs.",
    planned: [
      "Meal, daily, weekly and full program templates",
      "Private to each dietitian",
      "Duplicate and customise, search, categories, favourites",
    ],
  },
  {
    href: "/dashboard/foods",
    label: "Foods & recipes",
    icon: "foods",
    phase: 1,
    roles: CLINICAL_ROLES,
    summary: "The nutrition database, with Lebanese dishes built in.",
    planned: [
      "Verified food database with nutrients per 100 g",
      "Lebanese dishes: tabbouleh, fattoush, kibbeh, mujaddara, warak enab and more",
      "Recipe builder with ingredients and quantities",
      "Packaged products by barcode (data source and licence to confirm)",
    ],
  },
  {
    href: "/dashboard/appointments",
    label: "Appointments",
    icon: "appointments",
    phase: 2,
    summary: "Calendar, requests, reminders and attendance.",
    planned: [
      "Calendar with booking requests",
      "Reminders, rescheduling and cancellations",
      "Attendance tracking and consultation notes",
      "Pre-consultation patient summary",
    ],
  },
  {
    href: "/dashboard/messages",
    label: "Messages",
    icon: "messages",
    phase: 2,
    roles: CLINICAL_ROLES,
    summary: "Private conversations with your patients.",
    planned: ["One thread per patient", "Shared from the patient app", "Unread counters in the sidebar"],
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: "billing",
    phase: 2,
    roles: BILLING_ROLES,
    summary: "Packages, payments, balances and revenue.",
    planned: [
      "Consultation pricing and patient packages",
      "Payments, outstanding balances, remaining consultations",
      "Package expiry alerts",
      "Invoices, receipts and revenue reports",
    ],
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: "reports",
    phase: 3,
    roles: CLINICAL_ROLES,
    summary: "Branded PDF progress reports, reviewed before sending.",
    planned: [
      "Weight and body composition progress",
      "Food diary statistics and adherence",
      "Consultation history and dietitian observations",
      "Weekly and monthly summaries",
    ],
  },
  {
    href: "/dashboard/team",
    label: "Team",
    icon: "team",
    phase: 1,
    summary: "Dietitians and assistants in your practice.",
    planned: ["Invite by email", "Roles: owner, dietitian, assistant", "Assign patients to dietitians"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "settings",
    phase: 1,
    roles: OWNER_ONLY,
    summary: "Practice details, follow-up rules and device connections.",
    planned: [
      "Practice details, currency rate, branding for reports",
      "Follow-up rules and notification limits",
      "Device connections: InBody, Tanita, Withings, Apple Health",
    ],
  },
];

export function moduleFor(href: string) {
  const m = MODULES.find((x) => x.href === href);
  if (!m) throw new Error(`Unknown module ${href}`);
  return m;
}

export function navFor(role: PracticeRole, counts: Partial<Record<string, number>> = {}) {
  return MODULES.filter((m) => !m.roles || m.roles.includes(role)).map(({ href, label, icon }) => ({
    href,
    label,
    icon,
    badge: counts[href] ? counts[href] : undefined,
  }));
}

// Situations the daily briefing will flag (Phase 3). Each is a rule the
// dietitian can switch off or tune in Settings.
export const FOLLOW_UP_RULES = [
  { id: "no_logs", label: "No food logs for 3 days" },
  { id: "missed_check_in", label: "Missed daily check-in" },
  { id: "no_weight", label: "Weight not recorded this week" },
  { id: "missed_appointment", label: "Missed appointment" },
  { id: "package_expiring", label: "Package close to expiry" },
  { id: "upcoming_appointment", label: "Appointment tomorrow" },
  { id: "adherence", label: "Possible adherence problem" },
] as const;

// Device integrations (Phase 3). Status reflects research, not promises: see
// README, "Device integrations".
export const DEVICES = [
  { id: "withings", label: "Withings", note: "Public cloud API with patient consent (to verify)" },
  { id: "inbody", label: "InBody", note: "Business API access to confirm with InBody" },
  { id: "tanita", label: "Tanita", note: "Professional data export to investigate" },
  { id: "apple_health", label: "Apple Health", note: "Needs a native iOS app; not reachable from the web" },
] as const;
