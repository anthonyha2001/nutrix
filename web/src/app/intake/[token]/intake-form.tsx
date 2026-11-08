"use client";

import { useActionState } from "react";
import { Alert, Button, Card, Field, inputClass } from "@/components/ui";
import { ALLERGENS } from "@/lib/nutrition";
import { submitIntake } from "../actions";

const textarea = `${inputClass} h-auto py-2.5`;

export function IntakeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(submitIntake.bind(null, token), {});

  if (state.success) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-xl font-semibold">Thank you!</h2>
        <p className="mt-2 text-sm text-muted">Your answers were sent to your dietitian. See you at your appointment.</p>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Section title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth">
            <input name="date_of_birth" type="date" className={inputClass} />
          </Field>
          <Field label="Sex">
            <select name="sex" defaultValue="" className={inputClass}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </Field>
          <Field label="Phone (WhatsApp)">
            <input name="phone" type="tel" inputMode="tel" maxLength={40} placeholder="e.g. 71 123 456" className={inputClass} />
          </Field>
          <Field label="Activity">
            <select name="activity_level" defaultValue="" className={inputClass}>
              <option value="">Choose</option>
              <option value="sedentary">Mostly sitting, little exercise</option>
              <option value="light">Light: walking, exercise 1 to 2 times a week</option>
              <option value="moderate">Moderate: exercise 3 to 4 times a week</option>
              <option value="active">Active: exercise 5 or more times a week</option>
              <option value="very_active">Very active: physical job or daily training</option>
            </select>
          </Field>
          <Field label="Height (cm)">
            <input name="height_cm" inputMode="decimal" placeholder="e.g. 165" className={inputClass} />
          </Field>
          <Field label="Weight today (kg)">
            <input name="weight_kg" inputMode="decimal" placeholder="e.g. 72" className={inputClass} />
          </Field>
        </div>
        <Field label="What would you like to achieve?">
          <input name="goal" maxLength={500} placeholder="e.g. Lose weight, more energy, manage blood sugar" className={inputClass} />
        </Field>
      </Section>

      <Section title="Health">
        <Field label="Medical conditions" hint="Diabetes, thyroid, PCOS, blood pressure, surgeries…">
          <textarea name="conditions" rows={2} maxLength={2000} className={textarea} />
        </Field>
        <Field label="Medications and supplements">
          <textarea name="medications" rows={2} maxLength={2000} className={textarea} />
        </Field>
        <Field label="Family history" hint="Diabetes, heart disease, high cholesterol in close family.">
          <input name="family_history" maxLength={500} className={inputClass} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Food allergies or intolerances</legend>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <label key={a.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-canvas">
                <input type="checkbox" name="allergies" value={a.id} className="accent-ink" /> {a.label}
              </label>
            ))}
          </div>
          <input name="other_allergies" maxLength={80} placeholder="Other (e.g. kiwi, lactose)" className={`${inputClass} mt-2`} />
        </fieldset>
      </Section>

      <Section title="Eating habits">
        <Field label="Meals a day">
          <select name="meals_per_day" defaultValue="" className={inputClass}>
            <option value="">Choose</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4 or more">4 or more</option>
            <option value="It varies">It varies</option>
          </select>
        </Field>
        <Field label="A typical day of eating" hint="What you usually have, from breakfast to late snacks.">
          <textarea name="typical_day" rows={3} maxLength={2000} className={textarea} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Foods you love">
            <input name="likes" maxLength={500} className={inputClass} />
          </Field>
          <Field label="Foods you don't eat">
            <input name="dislikes" maxLength={500} className={inputClass} />
          </Field>
        </div>
        <Field label="Diets you tried before">
          <input name="previous_diets" maxLength={500} className={inputClass} />
        </Field>
      </Section>

      <Section title="Lifestyle">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sleep" hint="Hours a night, and quality.">
            <input name="sleep" maxLength={200} className={inputClass} />
          </Field>
          <Field label="Work" hint="Hours, shifts, desk or on your feet.">
            <input name="work" maxLength={200} className={inputClass} />
          </Field>
          <Field label="Exercise">
            <input name="exercise" maxLength={200} className={inputClass} />
          </Field>
          <Field label="Smoking or shisha">
            <input name="smoking" maxLength={200} className={inputClass} />
          </Field>
        </div>
        <Field label="Anything else your dietitian should know?">
          <textarea name="anything_else" rows={2} maxLength={2000} className={textarea} />
        </Field>
      </Section>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send to my dietitian"}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </Card>
  );
}
