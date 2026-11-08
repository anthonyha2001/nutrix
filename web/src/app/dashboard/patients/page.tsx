import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Smartphone } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { RowMenu } from "@/components/row-menu";
import { Badge, Card, EmptyState, inputClass, PageHeader } from "@/components/ui";
import { ageOn, formatDate, todayIn } from "@/lib/format";
import { clinicians } from "@/lib/practice";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { assignDietitian, createPatient, deletePatient, setPatientArchived, updatePatient } from "./actions";
import { AssignForm, PatientForm } from "./forms";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: PageProps<"/dashboard/patients">) {
  const { viewer, membership } = await requireStaff();
  const { q, show } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const archived = show === "archived";
  const canAssign = membership.role !== "dietitian";

  const supabase = await createClient();
  let request = supabase
    .from("patients")
    .select("id, full_name, email, phone, date_of_birth, sex, dietitian_id, user_id, created_at, archived_at, profiles!patients_dietitian_id_fkey(full_name, email)")
    .eq("practice_id", membership.practiceId)
    .order("full_name")
    .limit(500);
  request = archived ? request.not("archived_at", "is", null) : request.is("archived_at", null);
  if (query) request = request.or(`full_name.ilike.%${query.replace(/[%,()]/g, "")}%,phone.ilike.%${query.replace(/[%,()]/g, "")}%,email.ilike.%${query.replace(/[%,()]/g, "")}%`);
  const [{ data: patients }, team] = await Promise.all([request, canAssign ? clinicians(membership.practiceId) : Promise.resolve([])]);
  const today = todayIn(membership.timezone);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description={membership.role === "dietitian" ? "Patients assigned to you." : "Everyone in your practice."}
        action={
          <Dialog label="Add patient" icon={<Plus className="size-4" />} title="Add patient">
            <PatientForm action={createPatient} dietitians={canAssign ? team : undefined} defaultDietitian={membership.role === "owner" ? viewer.id : undefined} />
          </Dialog>
        }
      />

      <form className="flex flex-wrap gap-2" role="search">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={query} placeholder="Search by name, phone or email" className={`${inputClass} pl-10`} />
        </div>
        {archived && <input type="hidden" name="show" value="archived" />}
        <Link href={archived ? "/dashboard/patients" : "/dashboard/patients?show=archived"} className="inline-flex h-11 items-center rounded-xl px-4 text-sm text-muted hover:bg-surface hover:text-ink">
          {archived ? "Show active patients" : "Show archived"}
        </Link>
      </form>

      <Card>
        {!patients?.length ? (
          <EmptyState>
            <span className="block pt-5">
              {query ? `No patient matches "${query}".` : archived ? "No archived patients." : "No patients yet. Add your first patient to start their file."}
            </span>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {patients.map((p) => {
              const age = ageOn(p.date_of_birth, today);
              const dietitian = p.profiles?.full_name || p.profiles?.email;
              return (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-sm font-semibold">
                    {p.full_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <Link href={`/dashboard/patients/${p.id}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium hover:underline">{p.full_name}</span>
                      {p.user_id && <Smartphone className="size-3.5 shrink-0 text-brand-strong" aria-label="Uses the patient app" />}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {[age !== null ? `${age} y` : null, p.sex === "female" ? "F" : p.sex === "male" ? "M" : null, p.phone].filter(Boolean).join(" · ") ||
                        `Added ${formatDate(p.created_at)}`}
                    </span>
                  </Link>
                  {canAssign && (
                    <span className="hidden sm:block">{dietitian ? <Badge tone="gray">{dietitian}</Badge> : <Badge tone="amber">Not assigned</Badge>}</span>
                  )}
                  <RowMenu
                    items={[
                      { kind: "link", label: "Open file", href: `/dashboard/patients/${p.id}` },
                      {
                        kind: "dialog",
                        label: "Edit details",
                        title: "Edit patient",
                        content: <PatientForm action={updatePatient.bind(null, p.id)} patient={p} />,
                      },
                      canAssign && {
                        kind: "dialog",
                        label: "Assign dietitian",
                        title: `Assign ${p.full_name}`,
                        content: <AssignForm action={assignDietitian.bind(null, p.id)} dietitians={team} current={p.dietitian_id} />,
                      },
                      {
                        kind: "action",
                        label: archived ? "Restore" : "Archive",
                        action: setPatientArchived.bind(null, p.id, !archived),
                        confirm: archived ? undefined : `Archive ${p.full_name}? Their file is kept and can be restored.`,
                      },
                      membership.role === "owner" && {
                        kind: "action",
                        label: "Delete",
                        danger: true,
                        action: deletePatient.bind(null, p.id),
                        confirm: `Delete ${p.full_name} and their whole file (plans, measurements, notes)? This can't be undone. Archive instead to keep it.`,
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
