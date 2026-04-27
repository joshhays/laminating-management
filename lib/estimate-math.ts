/**
 * Default total cross-web bare margin when `laminateWidthInsetInches` is omitted (in per estimate UI/API).
 * Also the **minimum** total margin when the roll is wider than laminate (slitting required): ¼ in bare per side.
 */
export const LAMINATE_WIDTH_INSET_INCHES = 0.5;

/** ¼ in per side — same numeric total as {@link LAMINATE_WIDTH_INSET_INCHES} for the default model. */
export const LAMINATE_INSET_PER_SIDE_INCHES = 0.25;

/** MSI = one thousand square inches; film line cost = (film sq in ÷ this) × $/MSI. */
export const SQUARE_INCHES_PER_MSI = 1000;

/**
 * If the roll is wider than laminate width, side trim must be at least this wide (recoverable slit strip),
 * unless excess is zero (exact width match).
 */
export const MIN_SLIT_STRIP_WIDTH_INCHES = 0.5;

export type EstimateMetricsInput = {
  quantity: number;
  sheetLengthInches: number;
  materialWidthInches: number;
  rollWidthInches: number;
  /** $ per MSI (1000 sq in) of film consumed off the roll (full web width × run length). */
  pricePerFilmSquareInch: number;
  /** Total cross-web bare margin; defaults to {@link LAMINATE_WIDTH_INSET_INCHES}. */
  laminateWidthInsetInches?: number;
};

export type EstimateMetrics = {
  linearInches: number;
  estimatedLinearFeet: number;
  laminateWidthInches: number;
  slitExcessWidthInches: number;
  /** Substrate area (reference only — not used for line total). */
  materialSquareInches: number;
  /** Film laminated onto the sheet (linear × laminate width). */
  laminateFilmSquareInches: number;
  /** Film off the roll: full roll width × run length (includes dead stock from slitting). */
  filmFromRollSquareInches: number;
  /** Slit / side waste when roll is wider than laminate (same as dead stock area on web). */
  slitWasteSquareInches: number;
  /** Line total = (filmFromRollSquareInches / 1000) × pricePerFilmSquareInch ($/MSI). */
  totalCostFromFilm: number;
};

export function computeEstimateMetrics(input: EstimateMetricsInput): EstimateMetrics {
  const linearInches = input.quantity * input.sheetLengthInches;
  const estimatedLinearFeet = linearInches / 12;
  const inset =
    input.laminateWidthInsetInches != null && Number.isFinite(input.laminateWidthInsetInches)
      ? input.laminateWidthInsetInches
      : LAMINATE_WIDTH_INSET_INCHES;
  const laminateWidthInches = input.materialWidthInches - inset;

  if (!Number.isFinite(laminateWidthInches) || laminateWidthInches <= 0) {
    throw new Error(
      "Sheet width must be greater than the cross-web bare margin so laminate width stays positive.",
    );
  }
  if (input.rollWidthInches + 1e-9 < laminateWidthInches) {
    throw new Error(
      `Roll (${input.rollWidthInches} in wide) is narrower than required laminate width (${laminateWidthInches.toFixed(3)} in). Pick a wider roll or narrower sheet.`,
    );
  }

  const slitExcessWidthInches = Math.max(0, input.rollWidthInches - laminateWidthInches);

  if (
    slitExcessWidthInches > 1e-9 &&
    inset + 1e-9 < LAMINATE_WIDTH_INSET_INCHES
  ) {
    throw new Error(
      `Roll is wider than laminate (slitting required). Cross-web bare margin must be at least ${LAMINATE_WIDTH_INSET_INCHES} in total (${LAMINATE_INSET_PER_SIDE_INCHES} in per side). Increase the margin or use a narrower roll.`,
    );
  }

  if (
    slitExcessWidthInches > 0 &&
    slitExcessWidthInches + 1e-9 < MIN_SLIT_STRIP_WIDTH_INCHES
  ) {
    throw new Error(
      `Roll is only ${slitExcessWidthInches.toFixed(3)} in wider than laminate width. Slitting less than ${MIN_SLIT_STRIP_WIDTH_INCHES} in is not allowed — use a roll closer to ${laminateWidthInches.toFixed(3)} in wide, or at least ${(laminateWidthInches + MIN_SLIT_STRIP_WIDTH_INCHES).toFixed(2)} in wide.`,
    );
  }

  const materialSquareInches =
    input.quantity * input.materialWidthInches * input.sheetLengthInches;
  const laminateFilmSquareInches = linearInches * laminateWidthInches;
  const filmFromRollSquareInches = linearInches * input.rollWidthInches;
  const slitWasteSquareInches = linearInches * slitExcessWidthInches;
  const totalCostFromFilm =
    (filmFromRollSquareInches / SQUARE_INCHES_PER_MSI) * input.pricePerFilmSquareInch;

  return {
    linearInches,
    estimatedLinearFeet,
    laminateWidthInches,
    slitExcessWidthInches,
    materialSquareInches,
    laminateFilmSquareInches,
    filmFromRollSquareInches,
    slitWasteSquareInches,
    totalCostFromFilm,
  };
}

/** Film material $ from stored sq in and $/MSI snapshot. */
export function estimateFilmMaterialUsd(input: {
  filmFromRollSquareInches: number | null | undefined;
  pricePerFilmSquareInch: number | null | undefined;
}): number | null {
  if (
    input.filmFromRollSquareInches == null ||
    input.pricePerFilmSquareInch == null ||
    !Number.isFinite(input.filmFromRollSquareInches) ||
    !Number.isFinite(input.pricePerFilmSquareInch)
  ) {
    return null;
  }
  return (
    (input.filmFromRollSquareInches / SQUARE_INCHES_PER_MSI) * input.pricePerFilmSquareInch
  );
}

/**
 * Film line $ for display / job shop floor when only DB row is available.
 * Prefer MSI snapshot; otherwise total minus saved conversion estimates (legacy totals).
 */
export function estimateFilmMaterialUsdFromRow(e: {
  filmFromRollSquareInches: number | null | undefined;
  pricePerFilmSquareInch: number | null | undefined;
  totalCost: number;
  estimatedMachineCost: number | null | undefined;
  estimatedLaborCost: number | null | undefined;
  estimatedCutterCost?: number | null | undefined;
  estimatedSkidPackCost?: number | null | undefined;
  estimatedFinalDeliveryCost?: number | null | undefined;
}): number {
  const direct = estimateFilmMaterialUsd({
    filmFromRollSquareInches: e.filmFromRollSquareInches,
    pricePerFilmSquareInch: e.pricePerFilmSquareInch,
  });
  if (direct != null) return direct;
  const m = e.estimatedMachineCost ?? 0;
  const l = e.estimatedLaborCost ?? 0;
  const c = e.estimatedCutterCost ?? 0;
  const p = e.estimatedSkidPackCost ?? 0;
  const d = e.estimatedFinalDeliveryCost ?? 0;
  return Math.max(0, e.totalCost - m - l - c - p - d);
}
