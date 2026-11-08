// The Nutrix mark: a bold "N" whose right stem sprouts a leaf, drawn on a
// 100x100 grid with the same stroke weights as the Gymix mark. Colour comes
// from `currentColor`.
export const MARK_PATHS = [
  { d: "M30 76 V30 L62 70 V50", width: 15, cap: "butt", fill: false },
  { d: "M62 52 C62 38 66 30 74 26", width: 8.5, cap: "round", fill: false },
  { d: "M70 30 C70 19 77 13 88 12 C88 23 81 30 70 30 Z", width: 4, cap: "round", fill: true },
] as const;

export const MARK_TRANSFORM = "translate(-1,2)";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <g transform={MARK_TRANSFORM} stroke="currentColor" strokeLinejoin="round">
        {MARK_PATHS.map((p) => (
          <path key={p.d} d={p.d} strokeWidth={p.width} strokeLinecap={p.cap} fill={p.fill ? "currentColor" : "none"} />
        ))}
      </g>
    </svg>
  );
}
