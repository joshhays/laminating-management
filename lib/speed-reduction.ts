/**
 * Line speed from machine max (m/min) minus stacked slowdown % from matching rules.
 * Several rules on one job: 1st match = 100% of rule %, 2nd = 50%, 3rd = 25%, 4th = 12.5%, … (halves each time).
 */

import type { EstimatePaperColor } from "@prisma/client";

/** Weight for the k-th matched rule (1-based): 1, ½, ¼, ⅛, … */
export function slowdownStackWeightForMatchOrdinal(oneBasedMatchIndex: number): number {
  const k = Math.floor(oneBasedMatchIndex);
  if (!Number.isFinite(k) || k < 1) return 0;
  return 1 / Math.pow(2, k - 1);
}

export type SpeedReductionRuleInput = {
  sortOrder: number;
  name: string | null;
  paperGsmMin: number | null;
  paperGsmMax: number | null;
  stockType: string | null;
  printType: string | null;
  paperColor: EstimatePaperColor | null;
  filmMaterialType: string | null;
  quantityMin: number | null;
  quantityMax: number | null;
  sheetWidthMinInches: number | null;
  sheetWidthMaxInches: number | null;
  sheetLengthMinInches: number | null;
  sheetLengthMaxInches: number | null;
  slowdownPercent: number;
};

export type EstimateSpeedContext = {
  paperGsm: number;
  stockType: string;
  printType: string;
  paperColor: EstimatePaperColor;
  filmMaterialType: string;
  quantity: number;
  sheetWidthInches: number;
  sheetLengthInches: number;
};

function strWild(s: string | null | undefined): boolean {
  if (s == null || s.trim() === "") return true;
  return s.trim() === "*";
}

function strMatch(rule: string | null | undefined, value: string): boolean {
  if (strWild(rule)) return true;
  return rule!.trim().toLowerCase() === value.trim().toLowerCase();
}

function inRange(
  v: number,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min != null && Number.isFinite(min) && v + 1e-9 < min) return false;
  if (max != null && Number.isFinite(max) && v - 1e-9 > max) return false;
  return true;
}

function gsmMatches(
  rule: SpeedReductionRuleInput,
  paperGsm: number,
): boolean {
  const hasMin = rule.paperGsmMin != null && Number.isFinite(rule.paperGsmMin);
  const hasMax = rule.paperGsmMax != null && Number.isFinite(rule.paperGsmMax);
  if (!hasMin && !hasMax) return true;
  return inRange(paperGsm, rule.paperGsmMin, rule.paperGsmMax);
}

function quantityMatches(rule: SpeedReductionRuleInput, qty: number): boolean {
  if (rule.quantityMin != null && qty < rule.quantityMin) return false;
  if (rule.quantityMax != null && qty > rule.quantityMax) return false;
  return true;
}

function paperColorMatches(
  ruleColor: EstimatePaperColor | null,
  jobColor: EstimatePaperColor,
): boolean {
  if (ruleColor == null) return true;
  return ruleColor === jobColor;
}

function sheetMatches(rule: SpeedReductionRuleInput, w: number, l: number): boolean {
  const anyBound =
    rule.sheetWidthMinInches != null ||
    rule.sheetWidthMaxInches != null ||
    rule.sheetLengthMinInches != null ||
    rule.sheetLengthMaxInches != null;
  if (!anyBound) return true;
  return (
    inRange(w, rule.sheetWidthMinInches, rule.sheetWidthMaxInches) &&
    inRange(l, rule.sheetLengthMinInches, rule.sheetLengthMaxInches)
  );
}

export function ruleMatchesEstimate(
  rule: SpeedReductionRuleInput,
  ctx: EstimateSpeedContext,
): boolean {
  if (!gsmMatches(rule, ctx.paperGsm)) return false;
  if (!strMatch(rule.stockType, ctx.stockType)) return false;
  if (!strMatch(rule.printType, ctx.printType)) return false;
  if (!paperColorMatches(rule.paperColor, ctx.paperColor)) return false;
  if (!strWild(rule.filmMaterialType)) {
    if (
      rule.filmMaterialType!.trim().toUpperCase() !==
      ctx.filmMaterialType.trim().toUpperCase()
    ) {
      return false;
    }
  }
  if (!quantityMatches(rule, ctx.quantity)) return false;
  if (!sheetMatches(rule, ctx.sheetWidthInches, ctx.sheetLengthInches)) return false;
  return true;
}

/** One speed rule that matched the estimate context; applied % is what was added toward Σ (stacked). */
export type MatchedSlowdownRule = {
  sortOrder: number;
  name: string;
  /** Configured slowdown % on the rule row. */
  nominalSlowdownPercent: number;
  /** Contribution after stacking: nominal × slowdownStackWeightForMatchOrdinal(k). */
  appliedSlowdownPercent: number;
};

export type ResolvedSpeedReduction = {
  /** m/min after applying total slowdown to maxSpeedMetersMin */
  effectiveMetersPerMinute: number;
  /** Sum of applied (stacked) rule contributions before cap (0–100+) */
  rawTotalSlowdownPercent: number;
  /** min(maxTotalSlowdownPercent, Σ applied) — fraction subtracted from 100% of max speed */
  appliedSlowdownPercent: number;
  matchedRuleCount: number;
  matchedRules: MatchedSlowdownRule[];
};

/**
 * effectiveMpm = maxSpeedMetersMin × (1 − min(maxTotalSlowdownPercent, Σ applied slowdown %) / 100)
 */
export function resolveSpeedWithReductions(
  maxSpeedMetersMin: number,
  rules: SpeedReductionRuleInput[],
  ctx: EstimateSpeedContext,
  maxTotalSlowdownPercent: number = 100,
): ResolvedSpeedReduction {
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  let sum = 0;
  const matchedRules: MatchedSlowdownRule[] = [];
  let matchOrdinal = 0;
  for (const r of sorted) {
    if (!ruleMatchesEstimate(r, ctx)) continue;
    const nominal = Math.max(0, r.slowdownPercent);
    matchOrdinal += 1;
    const weight = slowdownStackWeightForMatchOrdinal(matchOrdinal);
    const applied = nominal * weight;
    sum += applied;
    matchedRules.push({
      sortOrder: r.sortOrder,
      name: r.name?.trim() || `Rule @ sort ${r.sortOrder}`,
      nominalSlowdownPercent: nominal,
      appliedSlowdownPercent: applied,
    });
  }
  let cap = maxTotalSlowdownPercent;
  if (!Number.isFinite(cap)) cap = 100;
  cap = Math.min(100, Math.max(0, cap));
  const applied = Math.min(cap, sum);
  const factor = 1 - applied / 100;
  const maxCap = Math.max(0, maxSpeedMetersMin);
  const effectiveMetersPerMinute = maxCap * Math.max(0, factor);
  return {
    effectiveMetersPerMinute,
    rawTotalSlowdownPercent: sum,
    appliedSlowdownPercent: applied,
    matchedRuleCount: matchedRules.length,
    matchedRules,
  };
}
