import { planFileName, renderPlanPdf } from "@/lib/plan-pdf";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// "Download PDF": the printable plan as an A4 file (?lang=en|fr|ar).
export async function GET(req: Request, { params }: RouteContext<"/api/plans/[id]/pdf">) {
  await requireStaff(CLINICAL_ROLES);
  const { id } = await params;
  const { data: plan } = await (await createClient()).from("meal_plans").select("name, patients(full_name)").eq("id", id).maybeSingle();
  if (!plan?.patients) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams.get("lang");
  const lang = q === "ar" || q === "fr" ? q : "en";
  const pdf = await renderPlanPdf(id, lang);
  const name = planFileName(plan.name, plan.patients.full_name);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="plan.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
