import { CountUp } from "@/components/count-up";
import { energySplit, round, type Macros, type Targets } from "@/lib/nutrition";
import { PATIENT_TEXT, type Lang } from "@/lib/patient-i18n";

// Energy and macros with a split bar, compared with targets when given.
// Same colours everywhere: protein blue, carbs amber, fat rose.
// `neutral`: show targets without colouring (patient app: no red numbers).
export function MacroSummary({
  totals,
  targets,
  compact = false,
  neutral = false,
  lang = "en",
}: {
  totals: Macros;
  targets?: Targets;
  compact?: boolean;
  neutral?: boolean;
  lang?: Lang;
}) {
  const m = PATIENT_TEXT[lang].macros;
  const split = energySplit(totals);
  const cells: { label: string; value: number; unit: string; target?: number; color?: string }[] = [
    { label: m.energy, value: totals.kcal, unit: m.kcal, target: targets?.kcal },
    { label: m.protein, value: totals.protein_g, unit: m.g, target: targets?.protein_g, color: "bg-protein" },
    { label: m.carbs, value: totals.carbs_g, unit: m.g, target: targets?.carbs_g, color: "bg-carbs" },
    { label: m.fat, value: totals.fat_g, unit: m.g, target: targets?.fat_g, color: "bg-fat" },
  ];
  return (
    <div className="space-y-2.5">
      <div className={`grid grid-cols-4 gap-2 ${compact ? "text-xs" : ""}`}>
        {cells.map((c) => {
          const off = c.target ? (c.value - c.target) / c.target : 0;
          const tone = !c.target || neutral ? "" : Math.abs(off) <= 0.05 ? "text-success" : Math.abs(off) <= 0.15 ? "text-amber-700" : "text-danger";
          return (
            <div key={c.label} className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                {c.color && <span className={`size-2 shrink-0 rounded-full ${c.color}`} />}
                {c.label}
              </span>
              <span className={`block font-semibold tabular-nums ${compact ? "text-sm" : "text-lg"} ${tone}`}>
                <CountUp value={String(round(c.value))} />
                <span className="ms-0.5 text-xs font-normal text-muted">{c.unit}</span>
              </span>
              {c.target ? <span className="block text-xs text-muted tabular-nums">{m.of(`${round(c.target)} ${c.unit}`)}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="bar-grow flex h-2 overflow-hidden rounded-full bg-line" aria-label={PATIENT_TEXT[lang].split(round(split.protein), round(split.carbs), round(split.fat))}>
        <span className="bg-protein" style={{ width: `${split.protein}%` }} />
        <span className="bg-carbs" style={{ width: `${split.carbs}%` }} />
        <span className="bg-fat" style={{ width: `${split.fat}%` }} />
      </div>
      {!compact && <p className="text-xs text-muted tabular-nums">{PATIENT_TEXT[lang].split(round(split.protein), round(split.carbs), round(split.fat))}</p>}
    </div>
  );
}
