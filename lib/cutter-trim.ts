/**
 * Cutter **base cuts** per lift from parent (run) sheet vs finished piece size, then × lifts for total strokes.
 *
 * - **Pieces per sheet** = max yield over standard and **90°-rotated** final size (see {@link calculateTrimImpositionBest}).
 * - **Columns / rows** for separating cuts match whichever orientation achieved that best layout (after tie-break).
 * - **1-up**, parent larger on **both** width and length: **4** edge cuts; one axis only: **2**.
 * - **Multi-up**: internal cuts from {@link impositionSeparatingCuts} (Dutch / bleed layout).
 */

import { calculateTrimImpositionBest, impositionSeparatingCuts } from "@/lib/print-cuts";

const EPS = 1e-6;

/** Parent run sheet vs final trim: match within this ⇒ no cutter on the estimate. */
const PARENT_FINAL_TRIM_MATCH_EPS_INCHES = 1e-3;

/**
 * True when finished size is set and differs from parent width × length (guillotine required).
 */
export function parentFinalDimensionsDifferForCutter(
  parentWidthInches: number,
  parentLengthInches: number,
  finalWidthInches: number | null,
  finalLengthInches: number | null,
  eps: number = PARENT_FINAL_TRIM_MATCH_EPS_INCHES,
): boolean {
  if (finalWidthInches == null || finalLengthInches == null) return false;
  if (
    !Number.isFinite(parentWidthInches) ||
    !Number.isFinite(parentLengthInches) ||
    !Number.isFinite(finalWidthInches) ||
    !Number.isFinite(finalLengthInches)
  ) {
    return false;
  }
  return (
    Math.abs(finalWidthInches - parentWidthInches) > eps ||
    Math.abs(finalLengthInches - parentLengthInches) > eps
  );
}

export type CutterTrimGeometryError = { ok: false; error: string };

export type CutterBaseCutsDetail = {
  baseCuts: number;
  edgeTrimCuts: number;
  separatingCuts: number;
  piecesPerSheet: number;
};

export type CutterTrimGeometryResult = CutterTrimGeometryError | ({ ok: true } & CutterBaseCutsDetail);

export function computeCutterBaseCutsFromTrim(
  materialWidthInches: number,
  sheetLengthInches: number,
  finalWidthInches: number | null,
  finalLengthInches: number | null,
  /** When true (default): Dutch-style internal cuts (fewer). False = bleed layout (more strokes). */
  noBleedDutchCut: boolean = true,
  /** When true: yield uses full run sheet (no 0.25 in inset), even for bleed layout. */
  isPressReady: boolean = false,
): CutterTrimGeometryResult {
  if (finalWidthInches == null || finalLengthInches == null) {
    return {
      ok: true,
      baseCuts: 0,
      edgeTrimCuts: 0,
      separatingCuts: 0,
      piecesPerSheet: 1,
    };
  }
  if (!Number.isFinite(materialWidthInches) || !Number.isFinite(sheetLengthInches)) {
    return { ok: false, error: "Run sheet dimensions must be valid numbers." };
  }
  if (!Number.isFinite(finalWidthInches) || !Number.isFinite(finalLengthInches)) {
    return { ok: false, error: "Final width and length must be valid numbers." };
  }
  if (finalWidthInches <= 0 || finalLengthInches <= 0) {
    return { ok: false, error: "Final size must be positive." };
  }
  if (
    finalWidthInches - materialWidthInches > EPS ||
    finalLengthInches - sheetLengthInches > EPS
  ) {
    return {
      ok: false,
      error: "Final size cannot be larger than run (original) sheet size.",
    };
  }

  const needW = materialWidthInches - finalWidthInches > EPS;
  const needL = sheetLengthInches - finalLengthInches > EPS;

  const { columns, rows, yield: ups } = calculateTrimImpositionBest(
    materialWidthInches,
    sheetLengthInches,
    finalWidthInches,
    finalLengthInches,
    noBleedDutchCut,
    { isPressReady },
  );
  if (ups < 1) {
    return {
      ok: false,
      error:
        "No finished pieces fit on the run sheet for this trim size (bleed layout reserves 0.25 in unless Dutch cut, or press-ready, is selected). Widen the run sheet or reduce final size.",
    };
  }

  let edgeTrimCuts = 0;
  if (needW && needL) {
    edgeTrimCuts = 4;
  } else if (needW || needL) {
    edgeTrimCuts = 2;
  }

  const separatingCuts = impositionSeparatingCuts(columns, rows, noBleedDutchCut);
  const baseCuts = edgeTrimCuts + separatingCuts;

  return {
    ok: true,
    baseCuts,
    edgeTrimCuts,
    separatingCuts,
    piecesPerSheet: ups,
  };
}

export function totalCutterStrokes(baseCuts: number, numLifts: number): number {
  if (!Number.isFinite(baseCuts) || baseCuts < 0) return 0;
  if (!Number.isFinite(numLifts) || numLifts < 0) return 0;
  return Math.floor(baseCuts) * Math.floor(numLifts);
}

export function finishedPieceCount(parentSheetQuantity: number, piecesPerSheet: number): number {
  const q = Math.floor(Number(parentSheetQuantity));
  const ups = Math.floor(Number(piecesPerSheet));
  if (!Number.isInteger(q) || q <= 0) return 0;
  if (!Number.isFinite(ups) || ups < 0) return 0;
  return q * ups;
}

/** @deprecated Use {@link computeCutterBaseCutsFromTrim} */
export function computeCutterStrokesPerLiftFromTrim(
  materialWidthInches: number,
  sheetLengthInches: number,
  finalWidthInches: number | null,
  finalLengthInches: number | null,
): CutterTrimGeometryResult {
  return computeCutterBaseCutsFromTrim(
    materialWidthInches,
    sheetLengthInches,
    finalWidthInches,
    finalLengthInches,
    true,
    false,
  );
}

/** @deprecated */
export function cutterCutsPerSheet(
  materialWidthInches: number,
  sheetLengthInches: number,
  finalWidthInches: number | null,
  finalLengthInches: number | null,
):
  | { ok: true; cutsPerSheet: number }
  | { ok: false; error: string } {
  const r = computeCutterBaseCutsFromTrim(
    materialWidthInches,
    sheetLengthInches,
    finalWidthInches,
    finalLengthInches,
    true,
    false,
  );
  if (!r.ok) return r;
  return { ok: true, cutsPerSheet: r.baseCuts };
}

/** @deprecated */
export function totalCutterCuts(cutsPerSheet: number, productionSheetCount: number): number {
  if (!Number.isFinite(cutsPerSheet) || cutsPerSheet < 0) return 0;
  if (!Number.isFinite(productionSheetCount) || productionSheetCount < 0) return 0;
  return Math.floor(productionSheetCount) * Math.floor(cutsPerSheet);
}
