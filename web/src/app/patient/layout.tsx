import Link from "next/link";
import { Suspense } from "react";
import { SupportBanner } from "@/components/support-banner";
import { Logo, Skeleton } from "@/components/ui";
import { practiceFeatures } from "@/lib/features";
import { patientText } from "@/lib/patient-lang";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { PatientNav } from "./patient-nav";

// Nutrix Patient, in English or Arabic (right to left). Delivered as an
// installable web app (like the Gymix member portal).
export default function PatientLayout({ children }: LayoutProps<"/patient">) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-64" />}>
      <PatientShell>{children}</PatientShell>
    </Suspense>
  );
}

async function PatientShell({ children }: { children: React.ReactNode }) {
  const { viewer, link } = await requirePatient();
  const { lang, t } = await patientText(viewer);
  const [features, { count }] = await Promise.all([
    practiceFeatures(link.practiceId),
    (await createClient()).from("messages").select("*", { count: "exact", head: true }).eq("patient_id", link.patientId).eq("from_patient", false).is("read_at", null),
  ]);
  const hidden = [!features.has("messages") && "/patient/messages", !features.has("patient_diary") && "/patient/diary"].filter((x): x is string => Boolean(x));

  return (
    <div dir={t.dir} lang={lang} className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/patient" dir="ltr">
            <Logo />
          </Link>
          <form action={signOut}>
            <button className="h-9 rounded-lg px-3 text-sm whitespace-nowrap text-muted hover:bg-canvas hover:text-ink">{t.logout}</button>
          </form>
        </div>
      </header>
      <main className="press mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[calc(var(--bottom-bar)+1.5rem)]">
        <Suspense fallback={null}>
          <SupportBanner />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64" />}>{children}</Suspense>
      </main>
      <PatientNav unread={count ?? 0} hidden={hidden} lang={lang} />
    </div>
  );
}
