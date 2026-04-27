import { sheetWeightFromGsm } from "@/lib/paper-spec-to-gsm";

/**
 * Pre-lam paper arrives in a single stack per skid; default max stack height (inches) when DB not loaded.
 * @deprecated Prefer `SkidPackSettings.maxStackHeightInches` from module setup.
 */
export const SKID_MAX_STACK_HEIGHT_INCHES = 40;

export const DEFAULT_MAX_STACK_HEIGHT_INCHES = 40;
export const DEFAULT_MAX_SKID_WEIGHT_LBS = 1500;

/** Outbound skid weight: substrate lb/sheet × this factor accounts for film (default +25%). */
export const LAMINATED_SHEET_WEIGHT_FACTOR = 1.25;

/**
 * Film thickness in US mils (1 mil = one thousandth of an inch = 0.001 in).
 * Not metric mm.
 */
export function milToInches(mil: number): number {
  return mil * 0.001;
}

/** Film added to overall sheet caliper (one pass / two passes / two different films). */
export function filmAddedThicknessInches(input: {
  primaryFilmThicknessMil: number;
  secondPassEnabled: boolean;
  secondFilmSameAsFirst: boolean;
  secondFilmThicknessMil: number | null;
}): number {
  const f1 = milToInches(input.primaryFilmThicknessMil);
  if (!input.secondPassEnabled) {
    return f1;
  }
  if (input.secondFilmSameAsFirst) {
    return 2 * f1;
  }
  const f2 =
    input.secondFilmThicknessMil != null && Number.isFinite(input.secondFilmThicknessMil)
      ? milToInches(input.secondFilmThicknessMil)
      : 0;
  return f1 + f2;
}

/**
 * Substrate caliper plus film (per-side mil → in).
 */
export function laminatedSheetThicknessInches(input: {
  substrateThicknessInches: number;
  primaryFilmThicknessMil: number;
  secondPassEnabled: boolean;
  secondFilmSameAsFirst: boolean;
  secondFilmThicknessMil: number | null;
}): number {
  const t0 = input.substrateThicknessInches;
  const film = filmAddedThicknessInches({
    primaryFilmThicknessMil: input.primaryFilmThicknessMil,
    secondPassEnabled: input.secondPassEnabled,
    secondFilmSameAsFirst: input.secondFilmSameAsFirst,
    secondFilmThicknessMil: input.secondFilmThicknessMil,
  });
  return t0 + film;
}

/** How many flat pieces (e.g. finished sheets) fit on one layer the size of the parent/run sheet. */
export function finishedSheetsPerLayerOnParent(
  parentWidthInches: number,
  parentLengthInches: number,
  finishedWidthInches: number,
  finishedLengthInches: number,
): number {
  const pw = Number(parentWidthInches);
  const pl = Number(parentLengthInches);
  const fw = Number(finishedWidthInches);
  const fl = Number(finishedLengthInches);
  if (![pw, pl, fw, fl].every((x) => Number.isFinite(x) && x > 0)) return 0;
  const orient1 = Math.floor(pl / fl) * Math.floor(pw / fw);
  const orient2 = Math.floor(pl / fw) * Math.floor(pw / fl);
  return Math.max(orient1, orient2, 0);
}

export function sheetsPerSkidInbound(substrateThicknessInches: number, maxHeight = SKID_MAX_STACK_HEIGHT_INCHES): number {
  const t = Number(substrateThicknessInches);
  const H = Number(maxHeight);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(H) || H <= 0) return 0;
  return Math.max(1, Math.floor(H / t));
}

function sheetsPerSkidFromWeight(maxWeightLbs: number, lbsPerSheet: number): number {
  const W = Number(maxWeightLbs);
  const w = Number(lbsPerSheet);
  if (!Number.isFinite(W) || W <= 0 || !Number.isFinite(w) || w <= 0) return 0;
  return Math.max(1, Math.floor(W / w));
}

export function sheetsPerSkidOutbound(input: {
  parentWidthInches: number;
  parentLengthInches: number;
  finishedWidthInches: number;
  finishedLengthInches: number;
  laminatedThicknessInches: number;
  maxStackHeightInches: number;
}): number {
  const tiles = finishedSheetsPerLayerOnParent(
    input.parentWidthInches,
    input.parentLengthInches,
    input.finishedWidthInches,
    input.finishedLengthInches,
  );
  if (tiles <= 0) return 0;
  const perLayer = tiles;
  const t = Number(input.laminatedThicknessInches);
  const H = Number(input.maxStackHeightInches);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(H) || H <= 0) return 0;
  const layers = Math.max(1, Math.floor(H / t));
  return perLayer * layers;
}

export type SkidPackEstimateInput = {
  productionSheetCount: number;
  finalTrimPiecesPerSheet: number;
  parentWidthInches: number;
  parentLengthInches: number;
  finishedWidthInches: number;
  finishedLengthInches: number;
  substrateThicknessInches: number;
  primaryFilmThicknessMil: number;
  secondPassEnabled: boolean;
  secondFilmSameAsFirst: boolean;
  secondFilmThicknessMil: number | null;
  pricePerSkidUsd: number;
  maxStackHeightInches?: number;
  /** Optional; when set with GSM, caps sheets/skid by weight (substrate only on inbound). */
  maxSkidWeightLbs?: number | null;
  /** Paper GSM for lb/sheet from parent / finished area (speed-rules GSM). */
  paperGsm?: number | null;
};

export function estimateSkidPack(input: SkidPackEstimateInput): {
  inboundSkids: number;
  outboundSkids: number;
  costUsd: number;
  sheetsPerSkidInbound: number;
  sheetsPerSkidOutbound: number;
  /** Substrate + film (used for outbound stack height). */
  laminatedThicknessInches: number;
  /** Film only in inches (mil × 0.001 per pass rules). */
  filmAddedThicknessInches: number;
  finishedSheetCount: number;
} | null {
  const H = input.maxStackHeightInches ?? SKID_MAX_STACK_HEIGHT_INCHES;
  const maxW =
    input.maxSkidWeightLbs != null &&
    Number.isFinite(input.maxSkidWeightLbs) &&
    input.maxSkidWeightLbs > 0
      ? input.maxSkidWeightLbs
      : null;
  const gsm =
    input.paperGsm != null && Number.isFinite(input.paperGsm) && input.paperGsm > 0
      ? input.paperGsm
      : null;

  const N = Math.floor(Number(input.productionSheetCount));
  const pps = Math.max(1, Math.floor(Number(input.finalTrimPiecesPerSheet)));
  if (!Number.isInteger(N) || N <= 0) return null;

  const tSub = Number(input.substrateThicknessInches);
  if (!Number.isFinite(tSub) || tSub <= 0) return null;

  const perInHeight = sheetsPerSkidInbound(tSub, H);
  if (perInHeight <= 0) return null;

  const parentW = Number(input.parentWidthInches);
  const parentL = Number(input.parentLengthInches);
  const substrateLbsParent =
    gsm != null && Number.isFinite(parentW) && Number.isFinite(parentL) && parentW > 0 && parentL > 0
      ? sheetWeightFromGsm(gsm, parentW, parentL)?.lbs ?? null
      : null;

  const perInWeight =
    maxW != null && substrateLbsParent != null && substrateLbsParent > 0
      ? sheetsPerSkidFromWeight(maxW, substrateLbsParent)
      : 0;
  const perIn =
    perInWeight > 0 ? Math.max(1, Math.min(perInHeight, perInWeight)) : perInHeight;
  const inboundSkids = Math.ceil(N / perIn);

  const tFilm = filmAddedThicknessInches({
    primaryFilmThicknessMil: input.primaryFilmThicknessMil,
    secondPassEnabled: input.secondPassEnabled,
    secondFilmSameAsFirst: input.secondFilmSameAsFirst,
    secondFilmThicknessMil: input.secondFilmThicknessMil,
  });
  const tLam = tSub + tFilm;
  if (!Number.isFinite(tLam) || tLam <= 0) return null;

  const perOutHeight = sheetsPerSkidOutbound({
    parentWidthInches: input.parentWidthInches,
    parentLengthInches: input.parentLengthInches,
    finishedWidthInches: input.finishedWidthInches,
    finishedLengthInches: input.finishedLengthInches,
    laminatedThicknessInches: tLam,
    maxStackHeightInches: H,
  });
  if (perOutHeight <= 0) return null;

  const finW = Number(input.finishedWidthInches);
  const finL = Number(input.finishedLengthInches);
  const lamLbsPerFinished =
    gsm != null && Number.isFinite(finW) && Number.isFinite(finL) && finW > 0 && finL > 0
      ? (sheetWeightFromGsm(gsm, finW, finL)?.lbs ?? 0) * LAMINATED_SHEET_WEIGHT_FACTOR
      : null;

  const perOutWeight =
    maxW != null && lamLbsPerFinished != null && lamLbsPerFinished > 0
      ? sheetsPerSkidFromWeight(maxW, lamLbsPerFinished)
      : 0;
  const perOut =
    perOutWeight > 0 ? Math.max(1, Math.min(perOutHeight, perOutWeight)) : perOutHeight;

  const finishedSheetCount = N * pps;
  const outboundSkids = Math.ceil(finishedSheetCount / perOut);

  const price = Number.isFinite(input.pricePerSkidUsd) && input.pricePerSkidUsd >= 0 ? input.pricePerSkidUsd : 0;
  const costUsd = outboundSkids * price;

  return {
    inboundSkids,
    outboundSkids,
    costUsd,
    sheetsPerSkidInbound: perIn,
    sheetsPerSkidOutbound: perOut,
    laminatedThicknessInches: tLam,
    filmAddedThicknessInches: tFilm,
    finishedSheetCount,
  };
}
