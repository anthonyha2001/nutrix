import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { FOLLOW_UP_RULES } from "@/lib/modules";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { viewer, membership } = await requireStaff();
  const supabase = await createClient();
  // RLS scopes this: the owner and assistants count the whole practice, a
  // dietitian counts their own patients.
  const { count: activePatients } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .eq("practice_id", membership.practiceId)
    .is("archived_at", null);

  const firstName = (viewer.fullName || "").split(" ")[0];
  const stats = [
    { label: "Active patients", value: String(activePatients ?? 0) },
    { label: "Appointments today", value: null },
    { label: "Need attention", value: null },
    { label: "Revenue this month", value: null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={firstName ? `Good day, ${firstName}` : "Overview"} description={membership.practiceName} />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value ?? <span className="text-muted/50">-</span>}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle action={<Badge tone="gray">Phase 3</Badge>}>Today&apos;s briefing</SectionTitle>
          <div className="px-5 pb-5">
            <p className="text-sm text-muted">
              Each morning Nutrix will list the patients who need you, and why. You choose which situations count and how
              often you hear about them.
            </p>
            <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
              {FOLLOW_UP_RULES.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <BellRing className="size-4 text-muted" />
                  <span className="flex-1">{r.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <SectionTitle>Upcoming appointments</SectionTitle>
          <p className="px-5 pb-5 text-sm text-muted">The calendar arrives with Appointments.</p>
        </Card>
      </div>
    </div>
  );
}
