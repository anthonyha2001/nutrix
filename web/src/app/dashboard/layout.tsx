import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { CommandPalette } from "@/components/command-palette";
import { SupportBanner } from "@/components/support-banner";
import { practiceFeatures } from "@/lib/features";
import { navFor } from "@/lib/modules";
import { ROLE_LABELS } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { NavLinks, NavSkeleton, Sidebar } from "./sidebar";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        practice={
          <Suspense fallback={<Skeleton className="h-14" />}>
            <PracticeCard />
          </Suspense>
        }
        nav={
          <Suspense fallback={<NavSkeleton />}>
            <RoleNav />
          </Suspense>
        }
        account={
          <Suspense fallback={<Skeleton className="h-12" />}>
            <AccountCard />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={null}>
          <SupportBanner />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>
      </main>
    </div>
  );
}

async function PracticeCard() {
  const { membership } = await requireStaff();
  return (
    <div className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ink text-sm font-semibold text-brand">
        {initials(membership.practiceName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{membership.practiceName}</span>
        <span className="block text-xs text-muted">Your practice</span>
      </span>
    </div>
  );
}

async function RoleNav() {
  const { membership } = await requireStaff();
  const supabase = await createClient();
  // Row-level security scopes both: requests the viewer may handle, and
  // unread patient messages in threads they can read (clinicians only).
  const [features, { count: requests }, { count: unread }] = await Promise.all([
    practiceFeatures(membership.practiceId),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("practice_id", membership.practiceId).eq("status", "requested"),
    membership.role === "assistant"
      ? Promise.resolve({ count: 0 })
      : supabase.from("messages").select("*", { count: "exact", head: true }).eq("from_patient", true).is("read_at", null),
  ]);
  const hidden = features.has("messages") ? [] : ["/dashboard/messages"];
  const items = navFor(membership.role, { "/dashboard/appointments": requests ?? 0, "/dashboard/messages": unread ?? 0 }, hidden);
  return (
    <>
      <CommandPalette pages={items.map(({ href, label }) => ({ href, label }))} clinical={membership.role !== "assistant"} />
      <NavLinks items={items} />
    </>
  );
}

async function AccountCard() {
  const { viewer, membership } = await requireStaff();
  const name = viewer.fullName || viewer.email;
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold">{initials(name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block text-xs text-muted">{ROLE_LABELS[membership.role]}</span>
      </span>
      <form action={signOut}>
        <button
          aria-label="Log out"
          title="Log out"
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-danger"
        >
          <LogOut className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}

function initials(text: string) {
  const parts = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "N";
}
