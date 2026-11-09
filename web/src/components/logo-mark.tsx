// The Nutrix mark: a bold geometric "N" whose right stem is cut on the slant,
// with a leaf growing above it. Drawn on a 100x100 grid; colour comes from
// `currentColor`. The two parts are separate so the splash can animate them.
export const MARK_N = "M18.5 28.5 H35.5 L65 60 V47 L80.8 40 V80 H62.5 L34.5 50 V80 H18.5 Z";
export const MARK_LEAF = "M61 41 C57 26 66 16 86 11 C86 27 78 36 61 41 Z";

// Nudges the drawing to the optical centre of the square.
export const MARK_TRANSFORM = "translate(0,4)";

export function LogoMark({ className = "", animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <g transform={MARK_TRANSFORM} fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d={MARK_N} className={animated ? "splash-n" : undefined} />
        <path d={MARK_LEAF} className={animated ? "splash-leaf" : undefined} />
      </g>
    </svg>
  );
}

// The mark as a complete SVG document (favicon, app icons).
export function markSvg({ background, color, radius = 22 }: { background: string; color: string; radius?: number }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="${radius}" fill="${background}"/><g transform="${MARK_TRANSFORM}" fill="${color}" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"><path d="${MARK_N}"/><path d="${MARK_LEAF}"/></g></svg>`;
}
