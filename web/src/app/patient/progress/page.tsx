import type { Metadata } from "next";
import { PatientPlaceholder } from "@/components/patient-placeholder";
import { patientScreen } from "@/lib/patient-app";

const screen = patientScreen("/patient/progress");

export const metadata: Metadata = { title: screen.label };

export default function ProgressPage() {
  return <PatientPlaceholder screen={screen} />;
}
