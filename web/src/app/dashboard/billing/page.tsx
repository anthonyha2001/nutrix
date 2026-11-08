import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleFor } from "@/lib/modules";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";

const info = moduleFor("/dashboard/billing");

export const metadata: Metadata = { title: info.label };

export default async function BillingPage() {
  await requireStaff(BILLING_ROLES);
  return <ModulePlaceholder module={info} />;
}
