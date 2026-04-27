/**
 * Cutter calculations — re-exports. Implementation is split by concern:
 * - `cutter-trim` — Perimeter / Verticals / Horizontals → strokes per lift
 * - `cutter-lift-plan` — sheets per lift / number of lifts
 * - `cutter-labor-cost` — hours and USD from machine time fields + rates
 * - `cutter-estimate` — labor/cost from total stroke count
 */

export {
  computeCutterBaseCutsFromTrim,
  computeCutterStrokesPerLiftFromTrim,
  cutterCutsPerSheet,
  finishedPieceCount,
  totalCutterCuts,
  totalCutterStrokes,
  type CutterBaseCutsDetail,
  type CutterTrimGeometryResult,
} from "@/lib/cutter-trim";

export { cutterLiftPlan, type CutterLiftPlanResult } from "@/lib/cutter-lift-plan";

export {
  cutterCostUsd,
  cutterJobCostUsd,
  cutterJobHours,
  type CutterJobCostBreakdown,
  type CutterJobHoursResult,
  type CutterLaborTimeFields,
} from "@/lib/cutter-labor-cost";

export {
  estimateCutterLaborAndCost,
  type CutterLaborAndCostResult,
} from "@/lib/cutter-estimate";
