import { Circle } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { PatientScreen } from "@/lib/patient-app";

export function PatientPlaceholder({ screen, greeting }: { screen: PatientScreen; greeting?: string }) {
  return (
    <div className="stagger space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting ?? screen.label}</h1>
        <p className="text-sm text-muted">{screen.summary}</p>
      </div>
      <Card className="rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Coming here</h2>
          <Badge tone={screen.phase === 1 ? "green" : "gray"}>Phase {screen.phase}</Badge>
        </div>
        <ul className="mt-4 space-y-2.5">
          {screen.planned.map((item) => (
            <li key={item} className="flex gap-3 text-sm">
              <Circle className="mt-1 size-3 shrink-0 text-brand-strong" strokeWidth={3} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
