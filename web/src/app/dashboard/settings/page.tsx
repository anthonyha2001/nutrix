import type { Metadata } from "next";
import { WhatsAppLog } from "@/components/whatsapp-log";
import { Activity, BellRing } from "lucide-react";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { DEVICES, FOLLOW_UP_RULES } from "@/lib/modules";
import { OWNER_ONLY } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PracticeForm } from "./practice-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { membership } = await requireStaff(OWNER_ONLY);
  const { data: practice } = await (await createClient()).from("practices").select("name, timezone, lbp_rate").eq("id", membership.practiceId).single();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your practice, follow-up rules and device connections." />
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Practice</h2>
        {practice && <PracticeForm practice={{ ...practice, lbp_rate: Number(practice.lbp_rate) }} timezones={Intl.supportedValuesOf("timeZone")} />}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle action={<Badge tone="gray">Phase 3</Badge>}>Follow-up rules</SectionTitle>
          <ul className="divide-y divide-line border-t border-line">
            {FOLLOW_UP_RULES.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <BellRing className="size-4 text-muted" />
                <span className="flex-1">{r.label}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle action={<Badge tone="gray">Phase 3</Badge>}>Device connections</SectionTitle>
          <ul className="divide-y divide-line border-t border-line">
            {DEVICES.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas">
                  <Activity className="size-4 text-muted" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{d.label}</span>
                  <span className="block text-xs text-muted">{d.note}</span>
                </span>
                <Badge tone="amber">Researching</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <WhatsAppLog practiceId={membership.practiceId} timeZone={membership.timezone} />
    </div>
  );
}
