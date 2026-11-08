import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Badge, Logo, Skeleton } from "@/components/ui";
import { signOut } from "../(auth)/actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <Badge tone="gray">Platform</Badge>
          </Link>
          <form action={signOut}>
            <button aria-label="Log out" title="Log out" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-danger">
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>
      </main>
    </div>
  );
}
