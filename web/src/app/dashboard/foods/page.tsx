import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleFor } from "@/lib/modules";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";

const info = moduleFor("/dashboard/foods");

export const metadata: Metadata = { title: info.label };

export default async function FoodsPage() {
  await requireStaff(CLINICAL_ROLES);
  return <ModulePlaceholder module={info} />;
}
