import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { leaveSupport } from "@/app/admin/actions";
import { getViewer } from "@/lib/session";

const ROLE = { owner: "Owner", dietitian: "Dietitian", assistant: "Assistant", patient: "Patient" } as const;

// A super admin inside a practice (support access or the lab): where, as whom,
// and the way back to the console.
export async function SupportBanner() {
  const viewer = await getViewer();
  const p = viewer?.supportPractice;
  if (!p) return null;
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-strong bg-brand/25 px-4 py-3 text-sm">
      <span className="flex items-center gap-2">
        <LifeBuoy className="size-4 shrink-0" />
        <span>
          {p.isLab ? "Lab" : "Support access"}: <strong>{p.name}</strong> as <strong>{ROLE[p.role]}</strong>.{!p.isLab && " Changes are real."}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Link href="/admin?tab=lab" className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-medium">
          Switch role
        </Link>
        <form action={leaveSupport}>
          <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white">Back to admin</button>
        </form>
      </span>
    </div>
  );
}
