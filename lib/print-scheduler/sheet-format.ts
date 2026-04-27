/**
 * Run sheet dimensions from ticket text (e.g. 13" x 19", 8.5x11).
 */

/** lb Cover → GSM (shop rule). */
export const LB_COVER_TO_GSM = 2.7;
/** lb Text → GSM (shop rule). */
export const LB_TEXT_TO_GSM = 1.48;

export function parseRunSheetInches(
  raw: string | null | undefined,
): { w: number; h: number } | null {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, " ").trim();
  const m = t.match(/(\d+(?:\.\d+)?)\s*["']?\s*[x×]\s*(\d+(?:\.\d+)?)\s*["']?/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * Small: up to letter class (long ≤ 11″, short ≤ 8.5″). Larger sheets use "large" IPM bands.
 */
export function sheetSizeBucket(w: number, h: number): "SMALL" | "LARGE" {
  const s = Math.min(w, h);
  const l = Math.max(w, h);
  if (l <= 11 && s <= 8.5) return "SMALL";
  return "LARGE";
}
