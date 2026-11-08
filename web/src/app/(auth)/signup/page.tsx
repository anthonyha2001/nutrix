import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <Card className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted">Dietitians set up a practice next. Patients go straight to their plan.</p>
      </div>
      <SignupForm />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </Card>
  );
}
