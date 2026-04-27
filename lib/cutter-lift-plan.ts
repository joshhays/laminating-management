/**
 * Stack height: sheets per lift from substrate caliper and cutter max pile height.
 */

const EPS = 1e-6;

export type CutterLiftPlanResult =
  | { ok: true; numLifts: number; sheetsPerLift: number }
  | { ok: false; error: string };

/**
 * How many sheets can be stacked within the cutter max height (one “lift”).
 * Requires positive thickness and max stack height on the cutter.
 */
export function cutterLiftPlan(
  productionQty: number,
  sheetThicknessInches: number,
  cutterMaxHeightInches: number | null | undefined,
): CutterLiftPlanResult {
  if (!Number.isFinite(productionQty) || productionQty <= 0) {
    return { ok: true, numLifts: 0, sheetsPerLift: 0 };
  }
  if (!Number.isFinite(sheetThicknessInches) || sheetThicknessInches <= 0) {
    return {
      ok: false,
      error: "Enter sheet thickness (inches) so cutter lifts can be calculated.",
    };
  }
  const maxH = cutterMaxHeightInches;
  if (maxH == null || !Number.isFinite(maxH) || maxH <= 0) {
    return {
      ok: false,
      error:
        "Set max stack height (inches) on the cutter machine to limit lift size from sheet thickness.",
    };
  }
  if (sheetThicknessInches - maxH > EPS) {
    return {
      ok: false,
      error: "Sheet thickness cannot exceed the cutter max stack height (lift size).",
    };
  }
  const sheetsPerLift = Math.max(1, Math.floor(maxH / sheetThicknessInches));
  const numLifts = Math.ceil(productionQty / sheetsPerLift);
  return { ok: true, numLifts, sheetsPerLift };
}
