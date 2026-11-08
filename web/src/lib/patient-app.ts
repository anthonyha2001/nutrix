import type { Phase } from "@/lib/modules";

// Screens of Nutrix Patient. Same idea as the professional MODULES list: one
// source for the tab bar and each screen's placeholder.

export type PatientIcon = "today" | "plan" | "diary" | "progress" | "messages" | "profile";

export type PatientScreen = {
  href: string;
  label: string;
  icon: PatientIcon;
  phase: Phase;
  summary: string;
  planned: string[];
  // Shown in the bottom bar; the rest live under "More".
  tab: boolean;
};

export const PATIENT_SCREENS: PatientScreen[] = [
  {
    href: "/patient",
    label: "Today",
    icon: "today",
    phase: 1,
    tab: true,
    summary: "What to eat today and how you're doing.",
    planned: ["Today's meals from your plan", "Calories and macros so far", "Water", "Daily check-in"],
  },
  {
    href: "/patient/plan",
    label: "Plan",
    icon: "plan",
    phase: 1,
    tab: true,
    summary: "Your meal plan from your dietitian.",
    planned: ["Meals with quantities and nutrition", "Swaps your dietitian approved"],
  },
  {
    href: "/patient/diary",
    label: "Diary",
    icon: "diary",
    phase: 2,
    tab: true,
    summary: "Log what you ate.",
    planned: [
      "Search foods, including Lebanese dishes",
      "Scan a product barcode",
      "Photograph a meal: Nutrix suggests foods and portions, you confirm before saving",
    ],
  },
  {
    href: "/patient/progress",
    label: "Progress",
    icon: "progress",
    phase: 2,
    tab: true,
    summary: "Weight, measurements and photos over time.",
    planned: ["Weight and measurements", "Progress photos", "Readings imported from connected scales"],
  },
  {
    href: "/patient/messages",
    label: "Messages",
    icon: "messages",
    phase: 2,
    tab: false,
    summary: "Talk to your dietitian.",
    planned: ["Private conversation with your dietitian", "Reminders and notifications"],
  },
  {
    href: "/patient/profile",
    label: "Profile",
    icon: "profile",
    phase: 1,
    tab: false,
    summary: "Your details and settings.",
    planned: ["Your details", "Reminder settings", "Connected devices"],
  },
];

export function patientScreen(href: string) {
  const s = PATIENT_SCREENS.find((x) => x.href === href);
  if (!s) throw new Error(`Unknown patient screen ${href}`);
  return s;
}
