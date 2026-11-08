import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { DEVICES, moduleFor } from "@/lib/modules";
import { OWNER_ONLY } from "@/lib/roles";
import { requireStaff } from "@/lib/session";

const info = moduleFor("/dashboard/settings");

export const metadata: Metadata = { title: info.label };

export default async function SettingsPage() {
  await requireStaff(OWNER_ONLY);
  return (
    <ModulePlaceholder module={info}>
      <Card>
        <SectionTitle action={<Badge tone="gray">Phase 3</Badge>}>Device connections</SectionTitle>
        <ul className="divide-y divide-line border-t border-line">
          {DEVICES.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3.5">
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
    </ModulePlaceholder>
  );
}
