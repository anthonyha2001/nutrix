import type { Metadata } from "next";
import { PatientPlaceholder } from "@/components/patient-placeholder";
import { patientScreen } from "@/lib/patient-app";
import { requirePatient } from "@/lib/session";

const screen = patientScreen("/patient");

export const metadata: Metadata = { title: screen.label };

export default async function TodayPage() {
  const { link } = await requirePatient();
  const firstName = link.fullName.split(" ")[0];
  return <PatientPlaceholder screen={screen} greeting={`Hi ${firstName}`} />;
}
