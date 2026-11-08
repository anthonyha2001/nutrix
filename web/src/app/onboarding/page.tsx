import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card, Logo, Skeleton } from "@/components/ui";
import { homePathFor, requireViewer } from "@/lib/session";
import { signOut } from "../(auth)/actions";
import { CreatePracticeForm } from "./create-practice-form";

export const metadata: Metadata = { title: "Set up your practice" };

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8 text-xl" />
      <div className="w-full max-w-md space-y-4">
        <Card className="p-6 space-y-5">
          <div>
            <h1 className="text-xl font-semibold">Set up your practice</h1>
            <p className="text-sm text-muted">You&apos;ll be the owner. You can invite dietitians and assistants next.</p>
          </div>
          <Suspense fallback={<Skeleton className="h-24" />}>
            <OnboardingGate />
          </Suspense>
        </Card>
        <Card className="p-4 text-sm text-muted">
          <strong className="text-ink">Are you a patient?</strong> Ask your dietitian to add your email to your file, then
          log in again. Your plan opens straight away.
        </Card>
        <form action={signOut} className="text-center">
          <button className="text-sm text-muted underline underline-offset-4 hover:text-ink">Log out</button>
        </form>
      </div>
    </main>
  );
}

async function OnboardingGate() {
  const viewer = await requireViewer();
  if (viewer.staff.length > 0 || viewer.patientOf.length > 0) redirect(homePathFor(viewer));
  return <CreatePracticeForm />;
}
