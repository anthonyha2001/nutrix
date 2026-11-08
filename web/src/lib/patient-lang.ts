import "server-only";
import { headers } from "next/headers";
import { PATIENT_TEXT, type Lang } from "@/lib/patient-i18n";
import type { Viewer } from "@/lib/session";

// The patient app's language: the one chosen in Profile, else the phone's.
export async function patientLang(viewer: Pick<Viewer, "locale">): Promise<Lang> {
  if (viewer.locale) return viewer.locale;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^\s*ar\b/i.test(accept) ? "ar" : "en";
}

export async function patientText(viewer: Pick<Viewer, "locale">) {
  const lang = await patientLang(viewer);
  return { lang, t: PATIENT_TEXT[lang] };
}
