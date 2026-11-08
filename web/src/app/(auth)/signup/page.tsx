import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Card className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted">Dietitians set up a practice next. Patients go straight to their plan.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SignupBody searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </Card>
  );
}

async function SignupBody({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const { email } = await searchParams;
  return <SignupForm email={typeof email === "string" ? email.slice(0, 200) : undefined} />;
}
