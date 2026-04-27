/**
 * Paper reference table (Paper Reference/PaperRef.csv): grade + basis weight (lb) or caliper (pt) → thickness (in).
 * Parsing and lookup are pure — safe to use in client or server bundles.
 */

export type PaperRefRow = {
  paperGrade: string;
  basisWeightLb: number;
  caliperInches: number;
  approxGsm: number | null;
  caliperPt: number | null;
};

/** When basis weight (lb) is not used, estimate GSM as caliper (pt) × this factor. */
export const GSM_PER_CALIPER_PT = 25;

export function gsmFromPaperCaliperPt(pt: number): number {
  if (!Number.isFinite(pt) || pt <= 0) return NaN;
  return pt * GSM_PER_CALIPER_PT;
}

function parseBasisWeightLbCell(cell: string): number | null {
  const m = cell.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Caliper cells may be like .0040 or ".0040""" from spreadsheet export. */
export function parseCaliperInchesCell(cell: string): number | null {
  const cleaned = cell.replace(/"/g, "").replace(/in\.?$/i, "").trim();
  // Prefer decimals that start with "." — \d+ alone would match "0042" in ".0042" → Number is 42.
  const m = cleaned.match(/(\d*\.\d+|\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseApproxGsmCell(cell: string): number | null {
  const m = cell.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** e.g. `4.0 pt` or `4.0` from spreadsheet export. */
export function parseCaliperPtCell(cell: string): number | null {
  const cleaned = cell.replace(/"/g, "").replace(/\s*pt\.?$/i, "").trim();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Load rows from raw CSV text (header row required). */
export function parsePaperRefCsv(text: string): PaperRefRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const out: PaperRefRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),(.+)$/);
    if (!m) continue;
    const paperGrade = m[1].trim();
    const basisLb = parseBasisWeightLbCell(m[2]);
    const approxGsm = parseApproxGsmCell(m[3]);
    const calPt = parseCaliperPtCell(m[4]);
    const cal = parseCaliperInchesCell(m[5]);
    if (!paperGrade || basisLb == null || cal == null) continue;
    out.push({
      paperGrade,
      basisWeightLb: basisLb,
      caliperInches: cal,
      approxGsm,
      caliperPt: calPt,
    });
  }
  return out;
}

export function lookupCaliperInches(
  paperGrade: string,
  basisWeightLb: number,
  rows: PaperRefRow[],
): number | null {
  if (!paperGrade.trim() || !Number.isFinite(basisWeightLb) || basisWeightLb <= 0) return null;
  const g = paperGrade.trim();
  const row = rows.find(
    (r) => r.paperGrade === g && Math.abs(r.basisWeightLb - basisWeightLb) < 1e-6,
  );
  return row ? row.caliperInches : null;
}

/** Match exported “pt” values that may differ slightly from typed input. */
export const PAPER_REF_CALIPER_PT_TOLERANCE = 0.05;

export function findPaperRefRowByGradeAndPt(
  paperGrade: string,
  caliperPt: number,
  rows: PaperRefRow[],
  tolerance: number = PAPER_REF_CALIPER_PT_TOLERANCE,
): PaperRefRow | null {
  if (!paperGrade.trim() || !Number.isFinite(caliperPt) || caliperPt <= 0) return null;
  const g = paperGrade.trim();
  return (
    rows.find(
      (r) =>
        r.paperGrade === g &&
        r.caliperPt != null &&
        Number.isFinite(r.caliperPt) &&
        Math.abs(r.caliperPt - caliperPt) <= tolerance,
    ) ?? null
  );
}

export function lookupCaliperInchesByPt(
  paperGrade: string,
  caliperPt: number,
  rows: PaperRefRow[],
): number | null {
  const row = findPaperRefRowByGradeAndPt(paperGrade, caliperPt, rows);
  if (!row) return null;
  const cal = row.caliperInches;
  return cal != null && Number.isFinite(cal) && cal > 0 ? cal : null;
}

/**
 * Substrate thickness (in) from PaperRef “Caliper (Inches)” for a given caliper (pt).
 * Prefer a row whose Stock category matches `paperGrade` and whose “Caliper (pt)” matches.
 * If none, use rows that match pt only: return inches only when every match agrees on thickness
 * (same ref value for ambiguous grades in the table).
 */
export function lookupCaliperInchesFromRefForPt(
  paperGrade: string,
  caliperPt: number,
  rows: PaperRefRow[],
  tolerance: number = PAPER_REF_CALIPER_PT_TOLERANCE,
): number | null {
  const byGrade = lookupCaliperInchesByPt(paperGrade, caliperPt, rows);
  if (byGrade != null) return byGrade;

  const ptMatches = rows.filter(
    (r) =>
      r.caliperPt != null &&
      Number.isFinite(r.caliperPt) &&
      Math.abs(r.caliperPt - caliperPt) <= tolerance,
  );
  if (ptMatches.length === 0) return null;
  const inchesList = ptMatches
    .map((r) => r.caliperInches)
    .filter((c): c is number => Number.isFinite(c) && c > 0);
  if (inchesList.length === 0) return null;
  const ref = inchesList[0]!;
  return inchesList.every((c) => Math.abs(c - ref) < 1e-9) ? ref : null;
}

/** First # / lb / lbs in the spec, for caliper lookup when GSM path didn’t set basisLb. */
export function parseLooseBasisLb(spec: string): number | null {
  const lower = spec.trim().toLowerCase();
  const match = lower.match(/(\d+(?:\.\d+)?)\s*(?:#|lb|lbs|\bpounds?\b)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : null;
}

/** Display caliper like PaperRef / Excel: `.0075` (four decimals, no leading 0 before the dot when &lt; 1 in). */
export function formatSheetThicknessInchesLikePaperRef(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0.0000";
  const fixed = n.toFixed(4);
  if (n > 0 && n < 1 && fixed.startsWith("0.")) {
    return fixed.slice(1);
  }
  if (n < 0 && n > -1 && fixed.startsWith("-0.")) {
    return `-${fixed.slice(3)}`;
  }
  return fixed;
}
