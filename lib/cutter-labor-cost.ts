/**
 * Cutter elapsed hours (setup, build/lift cycles, per-cut time) and $ using machine + labor rates.
 */

import { cutterLiftPlan } from "@/lib/cutter-lift-plan";

function finiteNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Time fields from a cutter machine (hours). */
export type CutterLaborTimeFields = {
  cutterBaseSetupHours: number;
  cutterBuildLiftHours: number;
  cutterAdditionalSetupHoursPerCut: number;
  cutterPerCutHours: number;
};

export type CutterJobHoursResult =
  | {
      ok: true;
      hours: number;
      numLifts: number;
      sheetsPerLift: number;
    }
  | { ok: false; error: string };

/**
 * Elapsed cutter hours: one base setup + build/lift cycle per lift + (additional setup + run) × total cut strokes.
 * Lifts come from stack height ÷ sheet thickness. Total strokes = cuts per sheet × production sheets
 * (cuts per sheet counts each trimmed edge — 2 per dimension).

 */
export function cutterJobHours(
  totalCuts: number,
  productionQty: number,
  sheetThicknessInches: number,
  cutterMaxHeightInches: number | null | undefined,
  m: CutterLaborTimeFields,
): CutterJobHoursResult {
  if (!Number.isFinite(totalCuts) || totalCuts <= 0) {
    return { ok: true, hours: 0, numLifts: 0, sheetsPerLift: 0 };
  }
  if (!Number.isFinite(productionQty) || productionQty <= 0) {
    return { ok: true, hours: 0, numLifts: 0, sheetsPerLift: 0 };
  }

  const lift = cutterLiftPlan(productionQty, sheetThicknessInches, cutterMaxHeightInches);
  if (!lift.ok) return lift;
  const { numLifts, sheetsPerLift } = lift;

  const base = finiteNonNeg(m.cutterBaseSetupHours);
  const buildLiftTotal = finiteNonNeg(m.cutterBuildLiftHours) * numLifts;
  const perCut =
    finiteNonNeg(m.cutterAdditionalSetupHoursPerCut) + finiteNonNeg(m.cutterPerCutHours);
  const cutHours = perCut * totalCuts;
  const hours = base + buildLiftTotal + cutHours;
  return { ok: true, hours, numLifts, sheetsPerLift };
}

export type CutterJobCostBreakdown = {
  total: number;
  machine: number;
  labor: number;
};

/** Same cutter hours applied to machine $/hr and labor $/hr, then summed. */
export function cutterJobCostUsd(
  hours: number,
  machineHourlyRate: number,
  laborHourlyRate: number,
): CutterJobCostBreakdown {
  if (!Number.isFinite(hours) || hours <= 0) {
    return { total: 0, machine: 0, labor: 0 };
  }
  const machine = hours * finiteNonNeg(machineHourlyRate);
  const labor = hours * finiteNonNeg(laborHourlyRate);
  return { total: machine + labor, machine, labor };
}

export function cutterCostUsd(totalCuts: number, pricePerCut: number): number {
  if (!Number.isFinite(totalCuts) || totalCuts < 0) return 0;
  if (!Number.isFinite(pricePerCut) || pricePerCut < 0) return 0;
  return totalCuts * pricePerCut;
}
