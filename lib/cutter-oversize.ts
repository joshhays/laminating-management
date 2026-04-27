/**
 * Oversize sheet handling on cutters: lower lift stack and/or higher labor rate when long edge exceeds a threshold.
 */

/** When max(width, length) >= threshold (and threshold is set), the sheet is treated as oversize. */
export function isCutterOversizeSheet(
  sheetWidthInches: number,
  sheetLengthInches: number,
  oversizeMinLongEdgeInches: number | null | undefined,
): boolean {
  if (
    oversizeMinLongEdgeInches == null ||
    !Number.isFinite(oversizeMinLongEdgeInches) ||
    oversizeMinLongEdgeInches <= 0
  ) {
    return false;
  }
  if (!Number.isFinite(sheetWidthInches) || !Number.isFinite(sheetLengthInches)) {
    return false;
  }
  const longEdge = Math.max(sheetWidthInches, sheetLengthInches);
  return longEdge + 1e-9 >= oversizeMinLongEdgeInches;
}

export type CutterOversizeResolution = {
  oversize: boolean;
  effectiveLiftMaxHeightInches: number | null;
  effectiveLaborHourlyRate: number;
  /** Oversize cap is set and reduces stack height vs nominal max height. */
  liftCappedForOversize: boolean;
  /** Oversize and helper labor rate is set (used for cutter labor $). */
  usingHelperLaborRate: boolean;
};

export function resolveCutterOversizeForEstimate(input: {
  sheetWidthInches: number;
  sheetLengthInches: number;
  cutterMaxHeightInches: number | null;
  cutterOversizeMinLongEdgeInches: number | null;
  cutterOversizeMaxLiftHeightInches: number | null;
  laborHourlyRate: number;
  cutterHelperLaborHourlyRate: number | null;
}): CutterOversizeResolution {
  const oversize = isCutterOversizeSheet(
    input.sheetWidthInches,
    input.sheetLengthInches,
    input.cutterOversizeMinLongEdgeInches,
  );

  const baseMax = input.cutterMaxHeightInches;
  let effectiveLiftMaxHeightInches: number | null =
    baseMax != null && Number.isFinite(baseMax) && baseMax > 0 ? baseMax : null;

  let liftCappedForOversize = false;
  if (oversize) {
    const cap = input.cutterOversizeMaxLiftHeightInches;
    const capOk = cap != null && Number.isFinite(cap) && cap > 0;
    if (capOk) {
      if (effectiveLiftMaxHeightInches != null) {
        const capped = Math.min(effectiveLiftMaxHeightInches, cap);
        liftCappedForOversize = capped + 1e-9 < effectiveLiftMaxHeightInches;
        effectiveLiftMaxHeightInches = capped;
      } else {
        effectiveLiftMaxHeightInches = cap;
        liftCappedForOversize = true;
      }
    }
  }

  const baseLabor =
    Number.isFinite(input.laborHourlyRate) && input.laborHourlyRate >= 0
      ? input.laborHourlyRate
      : 0;
  let effectiveLaborHourlyRate = baseLabor;
  let usingHelperLaborRate = false;
  if (oversize) {
    const h = input.cutterHelperLaborHourlyRate;
    if (h != null && Number.isFinite(h) && h >= 0) {
      effectiveLaborHourlyRate = h;
      usingHelperLaborRate = true;
    }
  }

  return {
    oversize,
    effectiveLiftMaxHeightInches,
    effectiveLaborHourlyRate,
    liftCappedForOversize,
    usingHelperLaborRate,
  };
}
