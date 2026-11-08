import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleFor } from "@/lib/modules";
import { requireStaff } from "@/lib/session";

const info = moduleFor("/dashboard/messages");

export const metadata: Metadata = { title: info.label };

export default async function MessagesPage() {
  await requireStaff();
  return <ModulePlaceholder module={info} />;
}
