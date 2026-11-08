import Link from "next/link";
import { Suspense } from "react";
import { Logo, Skeleton } from "@/components/ui";
import { requirePatient } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { PatientNav } from "./patient-nav";

// Nutrix Patient, delivered first as an installable web app (same approach as
// the Gymix member portal). A native app comes later for barcode scanning
// polish and Apple Health; see README.
export default function PatientLayout({ children }: LayoutProps<"/patient">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/patient">
            <Logo />
          </Link>
          <form action={signOut}>
            <button className="h-9 rounded-lg px-3 text-sm whitespace-nowrap text-muted hover:bg-canvas hover:text-ink">Log out</button>
          </form>
        </div>
      </header>
      <main className="press mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[calc(var(--bottom-bar)+1.5rem)]">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <PatientGate>{children}</PatientGate>
        </Suspense>
      </main>
      <Suspense fallback={<PatientNav />}>
        <NavWithUnread />
      </Suspense>
    </div>
  );
}

async function NavWithUnread() {
  const { link } = await requirePatient();
  const { count } = await (await createClient())
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", link.patientId)
    .eq("from_patient", false)
    .is("read_at", null);
  return <PatientNav unread={count ?? 0} />;
}

async function PatientGate({ children }: { children: React.ReactNode }) {
  await requirePatient();
  return <>{children}</>;
}
