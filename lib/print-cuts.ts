/**
 * Print / guillotine cut planning for imposed sheets (width × height in inches).
 *
 * - **Usable area:** By default subtracts **0.25 in** trim on each side. Omitted when **press-ready**
 *   or **No bleed (Dutch)** is set (full parent is printable; exact final = parent fits).
 * - **Tiling:** `Math.floor((usable + EXACT_FIT_EPS) / piece)` guards float error (e.g. 24/12).
 * - **Yield:** max of **Option A** — floor(usableW/fw)×floor(usableH/fl) and **Option B** — rotated piece (fw/fl swap).
 */

const TRIM_MARGIN_INCHES = 0.25;
const EXACT_FIT_EPS = 0.001;
const DEFAULT_MAX_STACK_HEIGHT_INCHES = 3.5;

export type TrimImpositionOptions = {
  /**
   * When true with default margin rule: use full parent width × height for tiling (no 0.25 in inset).
   */
  isPressReady?: boolean;
  /**
   * No bleed (Dutch): use full parent for yield (allows final trim to equal run sheet), and fewer internal cuts elsewhere.
   */
  noBleedDutchCut?: boolean;
};

function omitTrimMargin(opts?: TrimImpositionOptions): boolean {
  return opts?.isPressReady === true || opts?.noBleedDutchCut === true;
}

function usableParentDimensions(
  parentWidth: number,
  parentHeight: number,
  opts?: TrimImpositionOptions,
): { usableW: number; usableH: number } {
  if (omitTrimMargin(opts)) {
    return { usableW: parentWidth, usableH: parentHeight };
  }
  return {
    usableW: parentWidth - 2 * TRIM_MARGIN_INCHES,
    usableH: parentHeight - 2 * TRIM_MARGIN_INCHES,
  };
}

/** Tiles of length `piece` along usable length `usable`, with tolerance for exact division. */
function tilesAlong(usableLength: number, pieceLength: number): number {
  if (
    !Number.isFinite(usableLength) ||
    !Number.isFinite(pieceLength) ||
    usableLength <= 0 ||
    pieceLength <= 0
  ) {
    return 0;
  }
  return Math.floor((usableLength + EXACT_FIT_EPS) / pieceLength);
}

/**
 * Single-orientation grid: `finalWidth` across parent width, `finalHeight` along parent height (after usable inset).
 */
export function getTrimImpositionGrid(
  parentWidth: number,
  parentHeight: number,
  finalWidth: number,
  finalHeight: number,
  opts?: TrimImpositionOptions,
): { columns: number; rows: number } {
  const { usableW, usableH } = usableParentDimensions(parentWidth, parentHeight, opts);
  const columns = tilesAlong(usableW, finalWidth);
  const rows = tilesAlong(usableH, finalHeight);
  return { columns, rows };
}

export function impositionSeparatingCuts(
  columns: number,
  rows: number,
  noBleedDutchCut: boolean,
): number {
  if (columns <= 0 || rows <= 0) return 0;
  if (noBleedDutchCut) {
    return Math.max(0, columns - 1) + Math.max(0, rows - 1);
  }
  return columns * 2 - 2 + (rows * 2 - 2);
}

/**
 * Imposition options for the grid (margin). `noBleedDutchCut` here must match cutter/Dutch setting.
 * `isPressReady` skips margin even for bleed layout.
 */
export function calculateTrimImpositionBest(
  parentWidth: number,
  parentHeight: number,
  finalWidth: number,
  finalHeight: number,
  noBleedDutchCut: boolean = true,
  opts?: Pick<TrimImpositionOptions, "isPressReady">,
): { columns: number; rows: number; yield: number; rotated: boolean } {
  const gridOpts: TrimImpositionOptions = {
    noBleedDutchCut,
    isPressReady: opts?.isPressReady === true,
  };
  const std = getTrimImpositionGrid(parentWidth, parentHeight, finalWidth, finalHeight, gridOpts);
  const rot = getTrimImpositionGrid(parentWidth, parentHeight, finalHeight, finalWidth, gridOpts);
  const yieldStd = std.columns * std.rows;
  const yieldRot = rot.columns * rot.rows;
  if (yieldRot > yieldStd) {
    return { columns: rot.columns, rows: rot.rows, yield: yieldRot, rotated: true };
  }
  if (yieldStd > yieldRot) {
    return { columns: std.columns, rows: std.rows, yield: yieldStd, rotated: false };
  }
  const cutsStd = impositionSeparatingCuts(std.columns, std.rows, noBleedDutchCut);
  const cutsRot = impositionSeparatingCuts(rot.columns, rot.rows, noBleedDutchCut);
  if (cutsRot < cutsStd) {
    return { columns: rot.columns, rows: rot.rows, yield: yieldStd, rotated: true };
  }
  if (cutsStd < cutsRot) {
    return { columns: std.columns, rows: std.rows, yield: yieldStd, rotated: false };
  }
  return { columns: std.columns, rows: std.rows, yield: yieldStd, rotated: false };
}

/**
 * Max yield over standard vs 90° rotation (Option A vs Option B), using the same margin rules as
 * {@link getTrimImpositionGrid}.
 */
export function calculateYield(
  parentWidth: number,
  parentHeight: number,
  finalWidth: number,
  finalHeight: number,
  opts?: TrimImpositionOptions,
): number {
  const std = getTrimImpositionGrid(parentWidth, parentHeight, finalWidth, finalHeight, opts);
  const rot = getTrimImpositionGrid(parentWidth, parentHeight, finalHeight, finalWidth, opts);
  return Math.max(std.columns * std.rows, rot.columns * rot.rows);
}

export function calculatePiecesPerSheetAtFinalTrim(
  parentWidth: number,
  parentHeight: number,
  finalWidth: number,
  finalHeight: number,
  opts?: TrimImpositionOptions,
): number {
  return calculateYield(parentWidth, parentHeight, finalWidth, finalHeight, opts);
}

export type CalculatePrintCutsResult = {
  yield: number;
  numLifts: number;
  totalBillableCuts: number;
};

export function calculatePrintCuts(
  parentWidth: number,
  parentHeight: number,
  finalWidth: number,
  finalHeight: number,
  sheetCount: number,
  caliper: number,
  hasBleed: boolean,
  maxStackHeightInches: number = DEFAULT_MAX_STACK_HEIGHT_INCHES,
  impositionOpts?: Pick<TrimImpositionOptions, "isPressReady">,
): CalculatePrintCutsResult {
  const noBleedDutch = !hasBleed;
  const { columns, rows } = calculateTrimImpositionBest(
    parentWidth,
    parentHeight,
    finalWidth,
    finalHeight,
    noBleedDutch,
    impositionOpts,
  );
  const yieldCount = columns * rows;
  const internalCuts =
    columns > 0 && rows > 0
      ? impositionSeparatingCuts(columns, rows, noBleedDutch)
      : 0;

  const safeCaliper = Number.isFinite(caliper) && caliper > 0 ? caliper : 0;
  const safeSheetCount = Number.isFinite(sheetCount) && sheetCount > 0 ? sheetCount : 0;
  const totalStackHeight = safeSheetCount * safeCaliper;
  const safeMaxStack =
    Number.isFinite(maxStackHeightInches) && maxStackHeightInches > 0
      ? maxStackHeightInches
      : DEFAULT_MAX_STACK_HEIGHT_INCHES;

  const numLifts =
    totalStackHeight > 0 ? Math.ceil(totalStackHeight / safeMaxStack) : 0;

  const cutsPerLift = 4 + internalCuts;
  const totalBillableCuts = cutsPerLift * numLifts;

  return {
    yield: yieldCount,
    numLifts,
    totalBillableCuts,
  };
}
