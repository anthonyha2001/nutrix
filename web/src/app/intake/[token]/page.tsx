import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Logo, Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Before your first visit", robots: { index: false, follow: false } };

// The patient's intake form, opened from the link the dietitian sent. No
// account needed; the link only shows the patient's first name.
export default function IntakePage({ params }: PageProps<"/intake/[token]">) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10">
      <Logo className="mb-8 text-xl" />
      <div className="w-full max-w-xl">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Intake params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Intake({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = await (await createClient()).rpc("intake_get", { p_token: token });
  const form = data?.[0];

  if (!form) return <Message title="This link is not valid">Ask your dietitian to send you a new one.</Message>;
  if (form.status === "submitted") return <Message title="Thank you!">Your answers were sent. See you at your appointment.</Message>;
  if (form.status === "expired") return <Message title="This link has expired">Ask {form.practice_name} to send you a new one.</Message>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {form.first_name}, before your first visit</h1>
        <p className="mt-1 text-sm text-muted">
          {form.practice_name} would like to know you a little before you meet. It takes about 5 minutes. Answer what you can: every question is optional, and only your
          dietitian sees your answers.
        </p>
      </div>
      <IntakeForm token={token} />
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{children}</p>
    </Card>
  );
}
