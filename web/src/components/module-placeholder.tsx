import { Circle } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PHASE_LABELS, type Module } from "@/lib/modules";

// Stand-in for a module that isn't built yet: what it is, what it will do and
// when. Replaced page by page as the phases ship.
export function ModulePlaceholder({ module, children }: { module: Module; children?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={module.label} description={module.summary} />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">What this page will do</h2>
          <Badge tone={module.phase === 1 ? "green" : "gray"}>{PHASE_LABELS[module.phase]}</Badge>
        </div>
        <ul className="mt-4 space-y-2.5">
          {module.planned.map((item) => (
            <li key={item} className="flex gap-3 text-sm">
              <Circle className="mt-1 size-3 shrink-0 text-brand-strong" strokeWidth={3} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
      {children}
    </div>
  );
}
