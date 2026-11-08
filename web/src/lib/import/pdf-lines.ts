import "server-only";
import { extractTextItems } from "unpdf";

// The text of a PDF as lines, rebuilt from the position of each piece of text
// so table rows stay together ("HbA1c   6.1   %   4.0 - 5.6"). A PDF with
// almost no text is a scan or a photo: it can't be read without AI.
export async function pdfLines(data: Uint8Array): Promise<{ lines: string[]; scanned: boolean; pages: number }> {
  const { totalPages, items } = await extractTextItems(data);
  const lines: string[] = [];
  let chars = 0;
  for (const page of items) {
    // Group by baseline: items within 2.5 points vertically are on the same row.
    const rows: { y: number; parts: { x: number; s: string; w: number; size: number }[] }[] = [];
    for (const it of page) {
      const s = it.str;
      if (!s || !s.trim()) continue;
      chars += s.trim().length;
      const row = rows.find((r) => Math.abs(r.y - it.y) <= 2.5);
      const part = { x: it.x, s, w: it.width, size: it.fontSize || 10 };
      if (row) row.parts.push(part);
      else rows.push({ y: it.y, parts: [part] });
    }
    rows.sort((a, b) => b.y - a.y); // top of the page first
    for (const r of rows) {
      r.parts.sort((a, b) => a.x - b.x);
      let line = "";
      let end = -Infinity;
      for (const p of r.parts) {
        // A wide gap is a column break: keep it visible as several spaces.
        const gap = p.x - end;
        line += line ? (gap > p.size * 1.2 ? "   " : gap > p.size * 0.15 ? " " : "") : "";
        line += p.s;
        end = p.x + p.w;
      }
      lines.push(line.replace(/\s+$/, ""));
    }
  }
  return { lines, scanned: chars < 40, pages: totalPages };
}
