"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookOpen, Globe, Loader2, Search } from "lucide-react";
import { saveOnlineFood, searchFoods, searchFoodsOnline, type OnlineResult } from "@/app/food-actions";
import { inputClass } from "@/components/ui";
import { round, type FoodHit } from "@/lib/nutrition";

const isBarcode = (q: string) => /^[0-9]{8,14}$/.test(q);

// Search box with results underneath. Picking a food hands it (with its
// servings) to `onPick`; the box clears for the next one. When the library has
// little for a query, Open Food Facts can be searched online; a product picked
// from there is saved to the library first.
export function FoodSearch({
  onPick,
  placeholder = "Search foods or a barcode, e.g. tabbouleh, labneh, chicken breast",
  autoFocus = false,
}: {
  onPick: (food: FoodHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodHit[]>([]);
  const [searched, setSearched] = useState("");
  const [online, setOnline] = useState<{ query: string; result: OnlineResult } | null>(null);
  const [pending, startTransition] = useTransition();
  const [onlinePending, startOnline] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const seq = useRef(0);

  const runOnline = (q: string) =>
    startOnline(async () => {
      // Shown only while the box still holds this query (see onlineHits).
      setOnline({ query: q, result: await searchFoodsOnline(q) });
    });

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
          // A scanned or typed barcode that isn't stored: look it up right away.
          if (hits.length === 0 && isBarcode(q)) runOnline(q);
        }
      });
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const q = query.trim();
  const shown = q.length >= 2 ? results : [];
  const onlineHits = online && online.query === q && online.result.status === "ok" ? online.result.hits : [];
  const settled = !pending && q.length >= 2 && searched === q;
  const canSearchOnline = settled && q.length >= 3 && results.length < 8 && online?.query !== q && !(online?.result.status === "off");

  const reset = () => {
    setQuery("");
    setResults([]);
    setOnline(null);
    setSaveError(false);
  };

  const pick = (f: FoodHit) => {
    if (!f.online) {
      onPick(f);
      reset();
      return;
    }
    const code = f.online;
    setSaving(code);
    setSaveError(false);
    saveOnlineFood(code).then((saved) => {
      setSaving(null);
      if (!saved) return setSaveError(true);
      onPick(saved);
      reset();
    });
  };

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
        {(pending || onlinePending) && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>

      {(shown.length > 0 || onlineHits.length > 0) && (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {shown.map((f) => (
            <FoodRow key={f.id} food={f} onPick={pick} busy={false} />
          ))}
          {onlineHits.length > 0 && (
            <li className="flex items-center gap-1.5 bg-canvas px-3.5 py-2 text-xs text-muted">
              <Globe className="size-3.5" /> From Open Food Facts (ODbL). Added to the library when you pick one.
            </li>
          )}
          {onlineHits.map((f) => (
            <FoodRow key={f.id} food={f} onPick={pick} busy={saving === f.online} disabled={saving !== null} />
          ))}
        </ul>
      )}

      {saveError && <p className="px-1 text-sm text-danger">Couldn&apos;t add that product. Try again, or add it as a new food from its label.</p>}

      {settled && results.length === 0 && !onlinePending && !(online?.query === q && onlineHits.length > 0) && (
        <p className="px-1 text-sm text-muted">
          No food matches &quot;{searched}&quot;
          {online?.query === q && online.result.status === "ok" ? " here or on Open Food Facts" : ""}. Try fewer or different words.
        </p>
      )}
      {online?.query === q && online.result.status === "error" && (
        <p className="px-1 text-sm text-muted">Open Food Facts didn&apos;t answer. Try again in a minute.</p>
      )}
      {canSearchOnline && (
        <button
          type="button"
          onClick={() => runOnline(q)}
          disabled={onlinePending}
          className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-brand-strong underline-offset-2 hover:underline disabled:opacity-60"
        >
          <Globe className="size-4" /> Search Open Food Facts for &quot;{q}&quot;
        </button>
      )}
    </div>
  );
}

function FoodRow({ food: f, onPick, busy, disabled = false }: { food: FoodHit; onPick: (f: FoodHit) => void; busy: boolean; disabled?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(f)}
        disabled={disabled}
        className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-canvas disabled:opacity-60"
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
          {busy ? (
            <Loader2 className="ml-auto size-4 animate-spin" aria-label="Adding" />
          ) : (
            <>
              <span className="block font-medium text-ink">{round(f.kcal)} kcal</span>
              per 100 g
            </>
          )}
        </span>
      </button>
    </li>
  );
}
