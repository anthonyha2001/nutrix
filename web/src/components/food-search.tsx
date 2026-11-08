"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import { searchFoods } from "@/app/food-actions";
import { inputClass } from "@/components/ui";
import { round, type FoodHit } from "@/lib/nutrition";

// Search box with results underneath. Picking a food hands it (with its
// servings) to `onPick`; the box clears for the next one.
export function FoodSearch({
  onPick,
  placeholder = "Search foods, e.g. tabbouleh, chicken breast, lentils",
  autoFocus = false,
}: {
  onPick: (food: FoodHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodHit[]>([]);
  const [searched, setSearched] = useState("");
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const hits = await searchFoods(q);
        if (id === seq.current) {
          setResults(hits);
          setSearched(q);
        }
      });
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const shown = query.trim().length >= 2 ? results : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="Search foods"
          className={`${inputClass} pl-10`}
        />
        {pending && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>
      {shown.length > 0 && (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {shown.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(f);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-canvas"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {f.is_recipe && <BookOpen className="size-3.5 shrink-0 text-brand-strong" aria-label="Recipe" />}
                    <span className="line-clamp-2">{f.name}</span>
                  </span>
                  <span className="block text-xs text-muted">
                    {f.source === "practice" ? "Your practice" : f.category}
                    {f.brand ? ` · ${f.brand}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted tabular-nums">
                  <span className="block font-medium text-ink">{round(f.kcal)} kcal</span>
                  per 100 g
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!pending && query.trim().length >= 2 && searched === query.trim() && results.length === 0 && (
        <p className="px-1 text-sm text-muted">No food matches &quot;{searched}&quot;. Try fewer or different words.</p>
      )}
    </div>
  );
}
