"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookOpen, Globe, Loader2, Search } from "lucide-react";
import { saveOnlineFood, searchFoods, searchFoodsOnline, type OnlineResult } from "@/app/food-actions";
import { inputClass } from "@/components/ui";
import { round, type FoodHit } from "@/lib/nutrition";
import { hasArabic, PATIENT_TEXT, type Lang } from "@/lib/patient-i18n";

const isBarcode = (q: string) => /^[0-9]{8,14}$/.test(q);

// Search box with results underneath. Picking a food hands it (with its
// servings) to `onPick`; the box clears for the next one. When the library has
// little for a query, Open Food Facts can be searched online; a product picked
// from there is saved to the library first.
export function FoodSearch({
  onPick,
  placeholder = "Search foods or a barcode, e.g. tabbouleh, labneh, chicken breast",
  autoFocus = false,
  lang = "en",
  allowOnline = true,
}: {
  onPick: (food: FoodHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
  // Patient app: their language, and no Open Food Facts lookup.
  lang?: Lang;
  allowOnline?: boolean;
}) {
  const t = PATIENT_TEXT[lang];
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
        const hits = await searchFoods(q, 25, lang);
        if (id === seq.current) {
          setResults(hits);
          setSearched(q);
          // A scanned or typed barcode that isn't stored: look it up right away.
          if (hits.length === 0 && isBarcode(q) && allowOnline) runOnline(q);
        }
      });
    }, 220);
    return () => clearTimeout(t);
  }, [query, lang, allowOnline]);

  const q = query.trim();
  const shown = q.length >= 2 ? results : [];
  const onlineHits = online && online.query === q && online.result.status === "ok" ? online.result.hits : [];
  const settled = !pending && q.length >= 2 && searched === q;
  const canSearchOnline = allowOnline && settled && q.length >= 3 && results.length < 8 && online?.query !== q && !(online?.result.status === "off");

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
        <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label={t.food.searchLabel}
          className={`${inputClass} ps-10`}
        />
        {(pending || onlinePending) && <Loader2 className="absolute top-1/2 end-3.5 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>

      {(shown.length > 0 || onlineHits.length > 0) && (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {shown.map((f) => (
            <FoodRow key={f.id} food={f} onPick={pick} busy={false} lang={lang} />
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
        lang === "en" ? (
          <p className="px-1 text-sm text-muted">
            No food matches &quot;{searched}&quot;
            {online?.query === q && online.result.status === "ok" ? " here or on Open Food Facts" : ""}. Try fewer or different words.
            {hasArabic(searched) && <span className="block">{t.food.arabicHint}</span>}
          </p>
        ) : (
          <p className="px-1 text-sm text-muted">
            {t.food.noMatch(searched)}
            {hasArabic(searched) && <span className="block">{t.food.arabicHint}</span>}
          </p>
        )
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

function FoodRow({ food: f, onPick, busy, disabled = false, lang = "en" }: { food: FoodHit; onPick: (f: FoodHit) => void; busy: boolean; disabled?: boolean; lang?: Lang }) {
  const t = PATIENT_TEXT[lang];
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(f)}
        disabled={disabled}
        className="flex w-full items-start gap-3 px-3.5 py-2.5 text-start hover:bg-canvas disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {f.is_recipe && <BookOpen className="size-3.5 shrink-0 text-brand-strong" aria-label={t.food.recipe} />}
            <bdi className="line-clamp-2">{f.name}</bdi>
          </span>
          <span className="block text-xs text-muted">
            {f.alt_name ? <bdi>{f.alt_name}</bdi> : f.source === "practice" ? t.food.yourPractice : f.category}
            {f.brand ? ` · ${f.brand}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-end text-xs text-muted tabular-nums">
          {busy ? (
            <Loader2 className="ms-auto size-4 animate-spin" aria-label="Adding" />
          ) : (
            <>
              <span className="block font-medium text-ink">
                {round(f.kcal)} {t.macros.kcal}
              </span>
              {t.food.per100}
            </>
          )}
        </span>
      </button>
    </li>
  );
}
