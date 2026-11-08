"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { SearchSelect } from "@/components/search-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { ALLERGENS } from "@/lib/nutrition";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
export type Person = { id: string; name: string };

const textareaClass = `${inputClass} h-auto py-2.5`;

function Submit({ pending, label, pendingLabel = "Saving…" }: { pending: boolean; label: string; pendingLabel?: string }) {
  return (
    <div className="flex justify-end pt-1">
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
    </div>
  );
}

export type PatientValues = {
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  sex: "female" | "male" | null;
};

export function PatientForm({
  action,
  patient,
  dietitians,
  defaultDietitian,
}: {
  action: Action;
  patient?: PatientValues;
  // Shown to owners and assistants when adding a patient.
  dietitians?: Person[];
  defaultDietitian?: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Full name">
        <input name="full_name" required minLength={2} maxLength={120} defaultValue={patient?.full_name} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" optional hint="For WhatsApp.">
          <input name="phone" type="tel" maxLength={30} defaultValue={patient?.phone ?? ""} placeholder="71 123 456" className={inputClass} />
        </Field>
        <Field label="Email" optional hint="Lets them use the patient app.">
          <input name="email" type="email" defaultValue={patient?.email ?? ""} className={inputClass} />
        </Field>
        <Field label="Date of birth" optional>
          <input name="date_of_birth" type="date" defaultValue={patient?.date_of_birth ?? ""} className={inputClass} />
        </Field>
        <Field label="Sex" optional>
          <select name="sex" defaultValue={patient?.sex ?? ""} className={inputClass}>
            <option value="">Not set</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
      </div>
      {dietitians && (
        <Field label="Dietitian">
          <SearchSelect name="dietitian_id" defaultValue={defaultDietitian ?? ""}>
            <option value="">Not assigned yet</option>
            {dietitians.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SearchSelect>
        </Field>
      )}
      <Submit pending={pending} label={patient ? "Save" : "Add patient"} />
    </form>
  );
}

export function AssignForm({ action, dietitians, current }: { action: Action; dietitians: Person[]; current: string | null }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm text-muted">Only the assigned dietitian (and the practice owner) can see this patient&apos;s clinical file.</p>
      <Field label="Dietitian">
        <SearchSelect name="dietitian_id" defaultValue={current ?? ""}>
          <option value="">Not assigned</option>
          {dietitians.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SearchSelect>
      </Field>
      <Submit pending={pending} label="Assign" />
    </form>
  );
}

export type HealthValues = {
  height_cm: number | null;
  activity_level: string | null;
  goal: string | null;
  medical_history: string | null;
  medications: string | null;
  nutrition_history: string | null;
  lifestyle: string | null;
};

export function HealthForm({ action, health }: { action: Action; health: HealthValues | null }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Height" optional>
          <div className="relative">
            <input name="height_cm" inputMode="decimal" defaultValue={health?.height_cm ?? ""} className={`${inputClass} pr-12`} />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted">cm</span>
          </div>
        </Field>
        <Field label="Activity level" optional>
          <select name="activity_level" defaultValue={health?.activity_level ?? ""} className={inputClass}>
            <option value="">Not set</option>
            <option value="sedentary">Sedentary</option>
            <option value="light">Lightly active</option>
            <option value="moderate">Moderately active</option>
            <option value="active">Active</option>
            <option value="very_active">Very active</option>
          </select>
        </Field>
      </div>
      <Field label="Goal" optional>
        <input name="goal" maxLength={500} defaultValue={health?.goal ?? ""} placeholder="e.g. Lose 6 kg, manage blood sugar" className={inputClass} />
      </Field>
      <Field label="Medical history" optional hint="Conditions, surgeries, lab results.">
        <textarea name="medical_history" rows={3} maxLength={5000} defaultValue={health?.medical_history ?? ""} className={textareaClass} />
      </Field>
      <Field label="Medications and supplements" optional>
        <textarea name="medications" rows={2} maxLength={2000} defaultValue={health?.medications ?? ""} className={textareaClass} />
      </Field>
      <Field label="Nutrition history" optional hint="Previous diets, eating habits, likes and dislikes.">
        <textarea name="nutrition_history" rows={3} maxLength={5000} defaultValue={health?.nutrition_history ?? ""} className={textareaClass} />
      </Field>
      <Field label="Lifestyle" optional hint="Sleep, work schedule, exercise.">
        <textarea name="lifestyle" rows={2} maxLength={2000} defaultValue={health?.lifestyle ?? ""} className={textareaClass} />
      </Field>
      <Submit pending={pending} label="Save" />
    </form>
  );
}

export function AllergyForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [allergen, setAllergen] = useState("gluten");
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Allergen">
          <select name="allergen" value={allergen} onChange={(e) => setAllergen(e.target.value)} className={inputClass}>
            {ALLERGENS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
        </Field>
        {allergen === "other" && (
          <Field label="Name">
            <input name="label" required maxLength={80} placeholder="e.g. Kiwi" className={inputClass} />
          </Field>
        )}
        <Field label="Type">
          <select name="kind" defaultValue="allergy" className={inputClass}>
            <option value="allergy">Allergy</option>
            <option value="intolerance">Intolerance</option>
          </select>
        </Field>
        <Field label="Severity">
          <select name="severity" defaultValue="moderate" className={inputClass}>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </Field>
      </div>
      <Field label="Notes" optional>
        <input name="notes" maxLength={500} className={inputClass} />
      </Field>
      {allergen === "other" && (
        <p className="text-xs text-muted">Plans can only warn automatically about the listed allergens.</p>
      )}
      <Submit pending={pending} label="Add" />
    </form>
  );
}

const METRIC_FIELDS = [
  { name: "weight_kg", label: "Weight", unit: "kg" },
  { name: "body_fat_pct", label: "Body fat", unit: "%" },
  { name: "muscle_mass_kg", label: "Muscle mass", unit: "kg" },
  { name: "body_water_pct", label: "Body water", unit: "%" },
  { name: "visceral_fat", label: "Visceral fat", unit: "level" },
  { name: "bmr_kcal", label: "BMR", unit: "kcal" },
  { name: "waist_cm", label: "Waist", unit: "cm" },
  { name: "hip_cm", label: "Hip", unit: "cm" },
];

export function MeasurementForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Date">
        <input name="measured_on" type="date" defaultValue={today} max={today} required className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {METRIC_FIELDS.map((m) => (
          <label key={m.name} className="block space-y-1.5">
            <span className="text-sm font-medium">{m.label}</span>
            <span className="relative block">
              <input name={m.name} inputMode="decimal" className={`${inputClass} pr-14`} />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted">{m.unit}</span>
            </span>
          </label>
        ))}
      </div>
      <Field label="Notes" optional hint="e.g. InBody 570, morning, fasted.">
        <input name="notes" maxLength={500} className={inputClass} />
      </Field>
      <Submit pending={pending} label="Save" />
    </form>
  );
}

export function NoteForm({ action, today, note }: { action: Action; today: string; note?: { title: string | null; body: string; noted_on: string } }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Title" optional>
          <input name="title" maxLength={120} defaultValue={note?.title ?? ""} placeholder="e.g. Follow-up, week 3" className={inputClass} />
        </Field>
        <Field label="Date">
          <input name="noted_on" type="date" defaultValue={note?.noted_on ?? today} required className={inputClass} />
        </Field>
      </div>
      <Field label="Note">
        <textarea name="body" required rows={8} maxLength={10000} defaultValue={note?.body} className={textareaClass} />
      </Field>
      <Submit pending={pending} label={note ? "Save" : "Add note"} />
    </form>
  );
}

export function FromTemplateForm({ action, templates }: { action: Action; templates: { id: string; name: string; kind: string; kcal: number | null }[] }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  if (templates.length === 0) {
    return <p className="text-sm text-muted">You have no templates yet. Build one in Templates, or save any plan as a template.</p>;
  }
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Template" hint="The plan is a copy: changing the template later won't change it.">
        <SearchSelect name="template_id" required defaultValue="">
          <option value="" disabled>
            Choose a template
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.kind}
              {t.kcal ? `, ${t.kcal} kcal` : ""})
            </option>
          ))}
        </SearchSelect>
      </Field>
      <Submit pending={pending} label="Create plan" pendingLabel="Creating…" />
    </form>
  );
}

export function SaveAsTemplateForm({ action, defaultName, days }: { action: Action; defaultName: string; days: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Template name">
        <input name="name" required maxLength={120} defaultValue={defaultName} className={inputClass} />
      </Field>
      <Field label="Type">
        <select name="kind" defaultValue={days === 1 ? "day" : days <= 7 ? "week" : "program"} className={inputClass}>
          {days === 1 && <option value="day">Daily template</option>}
          {days <= 7 && <option value="week">Weekly template</option>}
          <option value="program">Program</option>
        </select>
      </Field>
      <Submit pending={pending} label="Save template" />
    </form>
  );
}
