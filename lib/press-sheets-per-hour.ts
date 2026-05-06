/**
 * Nominal sheets per hour from rated line speed and sheet pitch along the web.
 * Pitch (in) = sheet length + gap; converted to metres; SPH = (speed m/min × 60) ÷ pitchM.
 */
export function sheetsPerHourFromPressLineSpeed(input: {
  maxSpeedMetersMin: number;
  sheetLengthInches: number;
  sheetGapInches: number;
}): number | null {
  const v = input.maxSpeedMetersMin;
  if (!Number.isFinite(v) || v <= 0) return null;
  const pitchIn = input.sheetLengthInches + input.sheetGapInches;
  if (!Number.isFinite(pitchIn) || pitchIn <= 0) return null;
  const pitchM = pitchIn * 0.0254;
  return (v * 60) / pitchM;
}

/** Sheet length used only for displaying SPH when min/max constrain the job (midpoint when both exist). */
export function referenceSheetLengthInchesForSph(opts: {
  minSheetLengthInches: number | null;
  maxSheetLengthInches: number | null;
}): number | null {
  const { minSheetLengthInches: lo, maxSheetLengthInches: hi } = opts;
  const a = lo != null && Number.isFinite(lo) ? lo : null;
  const b = hi != null && Number.isFinite(hi) ? hi : null;
  if (a != null && b != null) return (a + b) / 2;
  if (a != null) return a;
  if (b != null) return b;
  return null;
}
