import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleFor } from "@/lib/modules";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";

const info = moduleFor("/dashboard/meal-plans");

export const metadata: Metadata = { title: info.label };

export default async function MealPlansPage() {
  await requireStaff(CLINICAL_ROLES);
  return <ModulePlaceholder module={info} />;
}
