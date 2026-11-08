import type { Metadata } from "next";
import { PatientPlaceholder } from "@/components/patient-placeholder";
import { patientScreen } from "@/lib/patient-app";

const screen = patientScreen("/patient/profile");

export const metadata: Metadata = { title: screen.label };

export default function ProfilePage() {
  return <PatientPlaceholder screen={screen} />;
}
