// Screens of Nutrix Patient: one list for the bottom bar and the "More" sheet.
// Labels come from the patient's language (lib/patient-i18n.ts, nav).

export type PatientIcon = "today" | "plan" | "diary" | "progress" | "messages" | "appointments" | "shopping" | "profile";

export type PatientScreen = {
  href: string;
  icon: PatientIcon;
  // Shown in the bottom bar; the rest live under "More".
  tab: boolean;
};

export const PATIENT_SCREENS: PatientScreen[] = [
  { href: "/patient", icon: "today", tab: true },
  { href: "/patient/plan", icon: "plan", tab: true },
  { href: "/patient/diary", icon: "diary", tab: true },
  { href: "/patient/progress", icon: "progress", tab: true },
  { href: "/patient/shopping", icon: "shopping", tab: false },
  { href: "/patient/messages", icon: "messages", tab: false },
  { href: "/patient/appointments", icon: "appointments", tab: false },
  { href: "/patient/profile", icon: "profile", tab: false },
];
