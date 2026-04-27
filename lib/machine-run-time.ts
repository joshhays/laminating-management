/**
 * Run-time estimation: line speed = machine max (m/min) reduced by summed % from matching rules.
 * Job time = make ready + (run per pass × pass count) + side change (2 passes only) + wash up.
 */

import { EstimatePaperColor } from "@prisma/client";
import {
  type EstimateSpeedContext,
  type MatchedSlowdownRule,
  resolveSpeedWithReductions,
  type SpeedReductionRuleInput,
} from "@/lib/speed-reduction";

export type { MatchedSlowdownRule };

export type MachineForRunTime = {
  maxSpeedMetersMin: number;
  makeReadyMinutes: number;
  /** Added for Digital jobs (minutes); default 0 if omitted. */
  extraMakeReadyDigitalMinutes?: number;
  /** Added for Offset jobs (minutes); default 0 if omitted. */
  extraMakeReadyOffsetMinutes?: number;
  sideChangeMinutes: number;
  washUpMinutes: number;
  /** Cap on sum of matching rule slowdown % (0–100). Default 100 if omitted. */
  maxTotalSlowdownPercent?: number;
};

/** Extra make ready from machine settings when print type is Digital or Offset. */
export function extraMakeReadyMinutesForPrintType(
  machine: Pick<MachineForRunTime, "extraMakeReadyDigitalMinutes" | "extraMakeReadyOffsetMinutes">,
  printType?: string,
): number {
  const p = (printType ?? "").trim().toLowerCase();
  if (p === "digital") {
    return Math.max(0, Number(machine.extraMakeReadyDigitalMinutes ?? 0));
  }
  if (p === "offset") {
    return Math.max(0, Number(machine.extraMakeReadyOffsetMinutes ?? 0));
  }
  return 0;
}

export type JobRequirementsForRunTime = {
  paperGsm: number;
  stockType: string;
  quantity: number;
  linearFeet: number;
  printType?: string;
  /** White vs colored sheet stock (default WHITE in callers). */
  paperColor?: EstimatePaperColor;
  sheetWidthInches?: number;
  sheetLengthInches?: number;
  filmMaterialType?: string;
};

const FEET_TO_METERS = 0.3048;

export type RunTimeBreakdown = {
  /** Make ready + side change + wash up (not machine-on time). */
  setupMinutes: number;
  /** Total line run minutes (all passes). */
  runMinutes: number;
  totalMinutes: number;
  effectiveMpm: number;
  matchedRule: boolean;
  cappedByMaxSpeed: boolean;
  linearMeters: number;
};
export type RunTimeBreakdownWithSource = RunTimeBreakdown & {
  speedSource: "reduction_rules" | "max_only";
  appliedSlowdownPercent?: number;
  /** Sum of matching rule % before machine cap */
  rawTotalSlowdownPercent?: number;
  matchedRuleCount?: number;
  /** Rules that matched this estimate, in sort order, each contributing slowdown % to the sum. */
  matchedSlowdownRules?: MatchedSlowdownRule[];
  /** Machine cap on Σ rule % (same as Machine.maxTotalSlowdownPercent) when rules are evaluated. */
  maxTotalSlowdownCap?: number;
  /** Base make ready from machine (before print-type add-on). */
  makeReadyBaseMinutes: number;
  /** Minutes added for this job’s print process (Digital / Offset). */
  makeReadyExtraByPrintTypeMinutes: number;
  makeReadyMinutes: number;
  sideChangeMinutes: number;
  washUpMinutes: number;
  passCount: 1 | 2;
  runMinutesSinglePass: number;
  runMinutesTotal: number;
  nonRunLaborMinutes: number;
};

function canResolveReductions(req: JobRequirementsForRunTime): boolean {
  return (
    req.sheetWidthInches != null &&
    Number.isFinite(req.sheetWidthInches) &&
    req.sheetWidthInches > 0 &&
    req.sheetLengthInches != null &&
    Number.isFinite(req.sheetLengthInches) &&
    req.sheetLengthInches > 0 &&
    typeof req.filmMaterialType === "string" &&
    req.filmMaterialType.trim() !== ""
  );
}

export type MachineWithReductionRulesInput = MachineForRunTime & {
  speedReductionRules: SpeedReductionRuleInput[];
};

function buildContext(req: JobRequirementsForRunTime): EstimateSpeedContext {
  return {
    paperGsm: req.paperGsm,
    stockType: req.stockType.trim() || "*",
    printType: (req.printType ?? "").trim() || "*",
    paperColor: req.paperColor ?? EstimatePaperColor.WHITE,
    filmMaterialType: (req.filmMaterialType ?? "").trim() || "OTHER",
    quantity: req.quantity,
    sheetWidthInches: req.sheetWidthInches ?? 0,
    sheetLengthInches: req.sheetLengthInches ?? 0,
  };
}

function singlePassRunMinutesFromMpm(linearFeet: number, mpm: number): number {
  const linearMeters = Math.max(0, linearFeet) * FEET_TO_METERS;
  if (linearMeters <= 1e-12) {
    return 0;
  }
  if (mpm <= 1e-9) {
    return Number.POSITIVE_INFINITY;
  }
  return linearMeters / mpm;
}

function buildSinglePassBreakdown(
  linearFeet: number,
  mpm: number,
): Omit<RunTimeBreakdown, "setupMinutes" | "runMinutes" | "totalMinutes"> & {
  runMinutesSinglePass: number;
  linearMeters: number;
} {
  const linearMeters = Math.max(0, linearFeet) * FEET_TO_METERS;
  const runMinutesSinglePass = singlePassRunMinutesFromMpm(linearFeet, mpm);
  return {
    effectiveMpm: mpm,
    matchedRule: false,
    cappedByMaxSpeed: false,
    linearMeters,
    runMinutesSinglePass,
  };
}

/**
 * If the machine has reduction rules and the estimate supplies all matching fields,
 * line speed = max × (1 − min(machine max total slowdown, Σ applied rule %) / 100), with stacked weights 100%, 50%, 25%, 12.5%, … Otherwise full max speed.
 */
export function estimateTotalRunTimeFromMachine(
  machine: MachineWithReductionRulesInput,
  req: JobRequirementsForRunTime,
  options: { passCount: 1 | 2; linearFeetOnePass: number },
): RunTimeBreakdownWithSource {
  const maxCap = Math.max(0, machine.maxSpeedMetersMin);
  const maxSlow =
    machine.maxTotalSlowdownPercent !== undefined &&
    Number.isFinite(machine.maxTotalSlowdownPercent)
      ? machine.maxTotalSlowdownPercent
      : 100;

  const makeReadyBase = Math.max(0, machine.makeReadyMinutes);
  const makeReadyExtra = extraMakeReadyMinutesForPrintType(machine, req.printType);
  const makeReady = makeReadyBase + makeReadyExtra;
  const sideChange = Math.max(0, machine.sideChangeMinutes);
  const washUp = Math.max(0, machine.washUpMinutes);
  const passCount = options.passCount;

  const reqOnePass = { ...req, linearFeet: options.linearFeetOnePass };

  let effectiveMpm = maxCap;
  let matchedRuleCount = 0;
  let appliedSlowdownPercent: number | undefined;
  let rawTotalSlowdownPercent: number | undefined;
  let matchedSlowdownRules: MatchedSlowdownRule[] | undefined;
  let maxTotalSlowdownCap: number | undefined;
  let speedSource: "reduction_rules" | "max_only" = "max_only";

  if (machine.speedReductionRules.length > 0 && canResolveReductions(reqOnePass)) {
    const ctx = buildContext(reqOnePass);
    maxTotalSlowdownCap = maxSlow;
    const resolved = resolveSpeedWithReductions(
      maxCap,
      machine.speedReductionRules,
      ctx,
      maxSlow,
    );
    effectiveMpm = resolved.effectiveMetersPerMinute;
    matchedRuleCount = resolved.matchedRuleCount;
    appliedSlowdownPercent = resolved.appliedSlowdownPercent;
    rawTotalSlowdownPercent = resolved.rawTotalSlowdownPercent;
    matchedSlowdownRules = resolved.matchedRules;
    speedSource = "reduction_rules";
  }

  const base = buildSinglePassBreakdown(options.linearFeetOnePass, effectiveMpm);
  const runMinutesSinglePass = base.runMinutesSinglePass;
  const runMinutesTotal =
    runMinutesSinglePass === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : runMinutesSinglePass * passCount;

  const nonRunLaborMinutes =
    makeReady +
    washUp +
    (passCount === 2 ? sideChange : 0);

  const totalMinutes =
    runMinutesTotal === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : nonRunLaborMinutes + runMinutesTotal;

  return {
    setupMinutes: nonRunLaborMinutes,
    runMinutes: runMinutesTotal,
    totalMinutes,
    effectiveMpm,
    matchedRule: matchedRuleCount > 0,
    cappedByMaxSpeed: false,
    linearMeters: base.linearMeters,
    speedSource,
    appliedSlowdownPercent,
    rawTotalSlowdownPercent,
    matchedRuleCount,
    matchedSlowdownRules,
    maxTotalSlowdownCap,
    makeReadyBaseMinutes: makeReadyBase,
    makeReadyExtraByPrintTypeMinutes: makeReadyExtra,
    makeReadyMinutes: makeReady,
    sideChangeMinutes: sideChange,
    washUpMinutes: washUp,
    passCount,
    runMinutesSinglePass,
    runMinutesTotal,
    nonRunLaborMinutes,
  };
}
