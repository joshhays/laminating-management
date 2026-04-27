/**
 * Xerox Versant 4100 run-time estimation (print production rules).
 * IPM = impressions per minute; run time uses total impressions (duplex = 2× finished sheets).
 */

export type PaperBasis = "COVER" | "TEXT";

export type VersantRunInput = {
  /** Basis weight, e.g. 80 for "80 lb". */
  basisLb: number;
  /** Whether stock is cover or text (affects GSM conversion). */
  basis: PaperBasis;
  /** Sheet width in inches. */
  widthIn: number;
  /** Sheet height in inches. */
  heightIn: number;
  /** Finished sheet count (physical sheets out of the press). */
  quantityFinishedSheets: number;
  /** If true, each finished sheet needs 2 impressions (front + back). */
  duplex: boolean;
};

export type VersantRunEstimate = {
  gsm: number;
  format: "SMALL" | "LARGE";
  ipm: number;
  totalImpressions: number;
  runTimeMinutes: number;
  runTimeFormatted: string;
};

/** lb Cover → GSM */
const COVER_TO_GSM = 2.7;
/** lb Text → GSM */
const TEXT_TO_GSM = 1.48;

function lbsToGsm(lb: number, basis: PaperBasis): number {
  const factor = basis === "COVER" ? COVER_TO_GSM : TEXT_TO_GSM;
  return Math.round(lb * factor * 10) / 10;
}

/**
 * Small: up to 8.5×11 (either orientation).
 * Large: 11×17 through 13×19 class; anything larger than small uses large rules.
 */
function sheetFormat(
  widthIn: number,
  heightIn: number,
): "SMALL" | "LARGE" {
  const s = Math.min(widthIn, heightIn);
  const l = Math.max(widthIn, heightIn);
  if (l <= 11 && s <= 8.5) return "SMALL";
  return "LARGE";
}

/**
 * IPM bands: <300 gsm vs 301–400 gsm per spec; gsm ≥ 301 uses slower tier; >400 same as heavy band.
 */
function impressionsPerMinute(format: "SMALL" | "LARGE", gsm: number): number {
  const heavy = gsm >= 301;
  if (format === "SMALL") return heavy ? 80 : 100;
  return heavy ? 44 : 52;
}

function totalImpressions(
  finishedSheets: number,
  duplex: boolean,
): number {
  const imp = duplex ? finishedSheets * 2 : finishedSheets;
  return Math.max(0, Math.round(imp));
}

function formatHoursMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0 min";
  const m = Math.ceil(totalMinutes);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem} min`;
  if (rem === 0) return `${h} hr`;
  return `${h} hr ${rem} min`;
}

/**
 * Full estimate: GSM, IPM, impressions, run time.
 */
export function estimateVersant4100RunTime(
  input: VersantRunInput,
): VersantRunEstimate {
  const gsm = lbsToGsm(input.basisLb, input.basis);
  const format = sheetFormat(input.widthIn, input.heightIn);
  const ipm = impressionsPerMinute(format, gsm);
  const totalImpressionCount = totalImpressions(
    input.quantityFinishedSheets,
    input.duplex,
  );
  const runTimeMinutes =
    ipm > 0 ? totalImpressionCount / ipm : Number.POSITIVE_INFINITY;

  return {
    gsm,
    format,
    ipm,
    totalImpressions: totalImpressionCount,
    runTimeMinutes,
    runTimeFormatted: formatHoursMinutes(runTimeMinutes),
  };
}

/** Human-readable one-block summary for copy/paste or UI. */
export function formatVersantEstimateReport(
  input: VersantRunInput,
  est: VersantRunEstimate,
): string {
  const basisLabel = input.basis === "COVER" ? "lb Cover" : "lb Text";
  const sizeLabel = `${input.widthIn}×${input.heightIn} in`;
  const sides = input.duplex ? "Duplex" : "Simplex";
  return [
    `Stock: ${input.basisLb} ${basisLabel} (${sizeLabel}), ${sides}`,
    `GSM: ${est.gsm}`,
    `Format: ${est.format === "SMALL" ? "Small (≤8.5×11)" : "Large (11×17–13×19 class)"}`,
    `IPM used: ${est.ipm}`,
    `Total impressions: ${est.totalImpressions} (${input.quantityFinishedSheets} finished sheets${input.duplex ? " × 2" : ""})`,
    `Time estimate: ${est.runTimeFormatted} (${est.runTimeMinutes.toFixed(1)} min raw)`,
  ].join("\n");
}
