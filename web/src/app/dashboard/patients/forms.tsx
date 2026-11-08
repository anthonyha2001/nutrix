"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { SearchSelect } from "@/components/search-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { LAB_TESTS } from "@/lib/labs";
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
  target_weight_kg?: number | null;
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
        <Field label="Target weight" optional hint="The overview estimates when it may be reached.">
          <div className="relative">
            <input name="target_weight_kg" inputMode="decimal" defaultValue={health?.target_weight_kg ?? ""} className={`${inputClass} pr-12`} />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted">kg</span>
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
      <NoteBody defaultValue={note?.body ?? ""} />
      <Submit pending={pending} label={note ? "Save" : "Add note"} />
    </form>
  );
}

export function FromTemplateForm({
  action,
  templates,
  target,
}: {
  action: Action;
  templates: { id: string; name: string; kind: string; kcal: number | null }[];
  // The patient's suggested energy: templates closest to it come first.
  target?: { kcal: number; firstName: string };
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const distance = (kcal: number | null) => (target && kcal ? Math.abs(kcal - target.kcal) : Number.POSITIVE_INFINITY);
  const sorted = target ? [...templates].sort((a, b) => distance(a.kcal) - distance(b.kcal)) : templates;
  const close = (kcal: number | null) => target && kcal !== null && distance(kcal) <= target.kcal * 0.1;
  if (templates.length === 0) {
    return <p className="text-sm text-muted">You have no templates yet. Build one in Templates, or save any plan as a template.</p>;
  }
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Template"
        hint={
          target
            ? `Closest to ${target.firstName}'s suggested ${target.kcal.toLocaleString("en-US")} kcal first. The plan is a copy: changing the template later won't change it.`
            : "The plan is a copy: changing the template later won't change it."
        }
      >
        <SearchSelect name="template_id" required defaultValue="">
          <option value="" disabled>
            Choose a template
          </option>
          {sorted.map((t) => (
            <option key={t.id} value={t.id}>
              {close(t.kcal) ? "Close match: " : ""}
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

export function CopyPlanForm({ action, patients }: { action: Action; patients: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Patient" hint="A new draft opens for them, with the same meals. Targets are suggested from their own numbers.">
        <SearchSelect name="patient_id" required defaultValue="">
          <option value="" disabled>
            Choose a patient
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SearchSelect>
      </Field>
      <Submit pending={pending} label="Copy plan" pendingLabel="Copying…" />
    </form>
  );
}

// Structures to start a note from, and phrases dietitians write again and again.
const NOTE_TEMPLATES: { label: string; text: string }[] = [
  { label: "First visit", text: "Reason for visit:\nHistory and habits:\nObservations (weight, measurements):\nGoals agreed:\nPlan:\nNext visit:" },
  { label: "Follow-up", text: "Since last visit:\nWeight and measurements:\nAdherence (diary, check-ins):\nWhat worked, what was hard:\nChanges to the plan:\nNext visit:" },
  { label: "SOAP", text: "S (subjective):\nO (objective):\nA (assessment):\nP (plan):" },
];
const NOTE_PHRASES = [
  "Good adherence this week.",
  "Struggling with evening snacking.",
  "Discussed portion sizes.",
  "Increase water to 2 L a day.",
  "Added a high-protein breakfast.",
  "Reduce sugary drinks.",
  "Encouraged a daily 30-minute walk.",
  "Review in 2 weeks.",
];
const MY_TEMPLATES_KEY = "nutrix:note-templates";

function readMine(): { label: string; text: string }[] {
  try {
    return JSON.parse(localStorage.getItem(MY_TEMPLATES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function NoteBody({ defaultValue }: { defaultValue: string }) {
  const [text, setText] = useState(defaultValue);
  const [mine, setMine] = useState<{ label: string; text: string }[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setMine(readMine()), 0);
    return () => clearTimeout(t);
  }, []);

  // A structure goes at the end; a phrase goes where the cursor is.
  const addBlock = (block: string) => setText((t) => (t.trim() ? `${t.trimEnd()}\n\n${block}` : block));
  const addPhrase = (phrase: string) => {
    const el = area.current;
    const at = el ? el.selectionEnd : text.length;
    const before = text.slice(0, at);
    const sep = before && !/\s$/.test(before) ? " " : "";
    const next = before + sep + phrase + text.slice(at);
    setText(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = (before + sep + phrase).length;
      el.setSelectionRange(pos, pos);
    });
  };
  const [naming, setNaming] = useState<string | null>(null);
  const saveMine = () => {
    const label = naming?.trim();
    setNaming(null);
    if (!label || !text.trim()) return;
    const next = [...mine.filter((m) => m.label !== label), { label: label.slice(0, 40), text }].slice(-12);
    setMine(next);
    try {
      localStorage.setItem(MY_TEMPLATES_KEY, JSON.stringify(next));
    } catch {}
  };

  const chip = "h-7 rounded-lg bg-canvas px-2.5 text-xs font-medium text-ink/80 hover:text-ink";
  return (
    <Field label="Note">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Start from:</span>
          {[...NOTE_TEMPLATES, ...mine].map((t) => (
            <button key={t.label} type="button" onClick={() => addBlock(t.text)} className={chip}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea ref={area} name="body" required rows={9} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} className={textareaClass} />
        <div className="flex flex-wrap items-center gap-1.5">
          {NOTE_PHRASES.map((p) => (
            <button key={p} type="button" onClick={() => addPhrase(p)} className={chip}>
              + {p}
            </button>
          ))}
          {text.trim() && naming === null && (
            <button type="button" onClick={() => setNaming("")} className="h-7 px-2 text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
              Save as my template
            </button>
          )}
          {naming !== null && (
            <span className="flex items-center gap-1.5">
              <input
                autoFocus
                value={naming}
                onChange={(e) => setNaming(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveMine();
                  }
                  if (e.key === "Escape") setNaming(null);
                }}
                maxLength={40}
                placeholder="Template name"
                aria-label="Template name"
                className="h-7 w-40 rounded-lg border border-line px-2 text-xs outline-none focus:border-ink"
              />
              <button type="button" onClick={saveMine} disabled={!naming.trim()} className="h-7 rounded-lg bg-ink px-2.5 text-xs font-medium text-white disabled:opacity-40">
                Save
              </button>
            </span>
          )}
        </div>
      </div>
    </Field>
  );
}

export function LabForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [test, setTest] = useState(LAB_TESTS[0].id);
  const preset = LAB_TESTS.find((t) => t.id === test);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Test">
          <select name="test" value={test} onChange={(e) => setTest(e.target.value)} className={inputClass}>
            {LAB_TESTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
            <option value="other">Other test</option>
          </select>
        </Field>
        <Field label="Date">
          <input name="measured_on" type="date" defaultValue={today} required className={inputClass} />
        </Field>
      </div>
      {test === "other" && (
        <Field label="Test name">
          <input name="other_name" required maxLength={60} placeholder="e.g. Vitamin B9 (folate)" className={inputClass} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Result" hint={preset ? `Typical: ${preset.range}` : undefined}>
          <input name="value" inputMode="decimal" required className={inputClass} />
        </Field>
        <Field label="Unit">
          <input key={test} name="unit" maxLength={20} defaultValue={preset?.unit ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Note" optional>
        <input name="note" maxLength={300} placeholder="e.g. fasting, lab name" className={inputClass} />
      </Field>
      <Submit pending={pending} label="Add result" />
    </form>
  );
}
