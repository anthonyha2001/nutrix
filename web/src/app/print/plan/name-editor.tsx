"use client";

import { useState, useTransition } from "react";
import { showToast } from "@/components/toaster";
import { Alert, Button } from "@/components/ui";
import { saveFoodNames } from "./actions";

// Food names to confirm before the plan prints fully in Arabic or French.
// Suggestions only pre-fill the boxes; nothing is printed until it is saved.
export function NameEditor({ lang, foods }: { lang: "ar" | "fr"; foods: { id: string; name: string; current: string; suggestion: string }[] }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(foods.map((f) => [f.id, f.current || f.suggestion])));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const missing = foods.filter((f) => !f.current).length;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-5 print:hidden">
      <div>
        <p className="font-medium">{lang === "ar" ? "Names in Arabic" : "Names in French"}</p>
        <p className="text-sm text-muted">
          {missing
            ? `${missing} food${missing === 1 ? "" : "s"} in this plan ${missing === 1 ? "has" : "have"} no ${lang === "ar" ? "Arabic" : "French"} name yet, so ${missing === 1 ? "it prints" : "they print"} in English. Check the suggestions, then save: names are reused in every plan.`
            : "Every food in this plan has a confirmed name. Correct any of them here."}
        </p>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {foods.map((f) => (
          <li key={f.id} className="grid items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_1fr]">
            <span className="text-sm">
              {f.name}
              {!f.current && <span className="ml-2 text-xs text-amber-800">{f.suggestion ? "suggested" : "to name"}</span>}
            </span>
            <input
              dir={lang === "ar" ? "rtl" : "ltr"}
              lang={lang}
              value={values[f.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
              maxLength={200}
              placeholder={lang === "ar" ? "الاسم بالعربية" : "Nom en français"}
              aria-label={`${f.name} in ${lang === "ar" ? "Arabic" : "French"}`}
              className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink"
            />
          </li>
        ))}
      </ul>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const changed = foods.filter((f) => (values[f.id] ?? "").trim() !== f.current).map((f) => ({ foodId: f.id, name: (values[f.id] ?? "").trim() }));
            if (!changed.length) return;
            const r = await saveFoodNames(lang, changed);
            if (r.error) setError(r.error);
            else showToast(r.success ?? "Saved");
          })
        }
      >
        {pending ? "Saving…" : "Save names"}
      </Button>
    </div>
  );
}
