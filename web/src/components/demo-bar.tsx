import { FlaskConical, LayoutDashboard, Smartphone } from "lucide-react";
import { endDemo, switchDemoRole } from "@/app/demo/actions";
import { demoExpiry, isDemoEmail } from "@/lib/demo";
import { getViewer } from "@/lib/session";

const hoursLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));

// In a sample practice: a bar saying so, with the switch between the
// dietitian dashboard and the patient's phone, and the way to a real practice.
// Renders nothing in a real practice.
export async function DemoBar({ area }: { area: "owner" | "patient" }) {
  const viewer = await getViewer();
  if (!viewer || !isDemoEmail(viewer.email)) return null;
  const practiceId = area === "owner" ? viewer.staff[0]?.practiceId : viewer.patientOf[0]?.practiceId;
  if (!practiceId) return null;
  const expiry = await demoExpiry(practiceId);
  if (!expiry) return null;
  return (
    <div role="status" dir="ltr" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white">
      <span className="flex min-w-0 items-center gap-2">
        <FlaskConical className="size-4 shrink-0 text-brand" />
        <span>
          <strong className="font-semibold">Demo practice.</strong>{" "}
          <span className="text-white/70">Sample data, yours for {hoursLeft(expiry)} more hours. Nothing is sent to anyone.</span>
        </span>
      </span>
      <span className="ms-auto flex flex-wrap items-center gap-2">
        <form action={switchDemoRole.bind(null, area === "owner" ? "patient" : "owner")}>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-xs font-medium hover:bg-white/10">
            {area === "owner" ? <Smartphone className="size-3.5" /> : <LayoutDashboard className="size-3.5" />}
            {area === "owner" ? "Patient app" : "Dietitian dashboard"}
          </button>
        </form>
        <form action={endDemo.bind(null, "signup")}>
          <button className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-ink hover:bg-brand-strong">Open my practice</button>
        </form>
        <form action={endDemo.bind(null, "home")}>
          <button className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-white/60 hover:text-white">Exit</button>
        </form>
      </span>
    </div>
  );
}
