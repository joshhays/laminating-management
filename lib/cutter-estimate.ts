/**
 * Orchestrates estimate-side cutter labor & cost after geometry and thickness are known.
 *
 * Geometry (Perimeter, Verticals, Horizontals) and strokes-per-lift live in {@link computeCutterStrokesPerLiftFromTrim}.
 * Total job strokes = cutsPerLift × numLifts (see {@link totalCutterStrokes}).
 *
 * Substrate thickness (PaperRef vs manual) is resolved in `cutter-sheet-thickness` before calling here.
 */

import { cutterJobCostUsd, cutterJobHours, type CutterLaborTimeFields } from "@/lib/cutter-labor-cost";

export type CutterLaborAndCostResult =
  | {
      ok: true;
      hours: number;
      numLifts: number;
      sheetsPerLift: number;
      cost: ReturnType<typeof cutterJobCostUsd>;
    }
  | { ok: false; error: string };

/**
 * Hours and machine + labor $ given **total guillotine strokes** (already includes × lifts).
 * When totalCuts is 0, returns zero hours and cost.
 */
export function estimateCutterLaborAndCost(
  totalCuts: number,
  productionSheetCount: number,
  sheetThicknessInches: number,
  cutterMaxHeightInches: number | null | undefined,
  timeFields: CutterLaborTimeFields,
  machineHourlyRate: number,
  laborHourlyRate: number,
): CutterLaborAndCostResult {
  const hourResult = cutterJobHours(
    totalCuts,
    productionSheetCount,
    sheetThicknessInches,
    cutterMaxHeightInches,
    timeFields,
  );
  if (!hourResult.ok) return hourResult;
  const cost = cutterJobCostUsd(hourResult.hours, machineHourlyRate, laborHourlyRate);
  return {
    ok: true,
    hours: hourResult.hours,
    numLifts: hourResult.numLifts,
    sheetsPerLift: hourResult.sheetsPerLift,
    cost,
  };
}
