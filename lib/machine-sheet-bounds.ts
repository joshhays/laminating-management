export type SheetBounds = {
  minSheetWidthInches: number | null;
  maxSheetWidthInches: number | null;
  minSheetLengthInches: number | null;
  maxSheetLengthInches: number | null;
};

export type SheetBoundsIssue =
  | { ok: true }
  | { ok: false; message: string };

/** If min/max are null, that bound is not enforced. */
export function validateSheetAgainstMachineBounds(
  sheetWidthInches: number,
  sheetLengthInches: number,
  bounds: SheetBounds,
): SheetBoundsIssue {
  const { minSheetWidthInches: wMin, maxSheetWidthInches: wMax, minSheetLengthInches: lMin, maxSheetLengthInches: lMax } =
    bounds;

  if (wMin != null && Number.isFinite(wMin) && sheetWidthInches + 1e-9 < wMin) {
    return {
      ok: false,
      message: `Sheet width ${sheetWidthInches} in is below this machine’s minimum (${wMin} in).`,
    };
  }
  if (wMax != null && Number.isFinite(wMax) && sheetWidthInches - 1e-9 > wMax) {
    return {
      ok: false,
      message: `Sheet width ${sheetWidthInches} in is above this machine’s maximum (${wMax} in).`,
    };
  }
  if (lMin != null && Number.isFinite(lMin) && sheetLengthInches + 1e-9 < lMin) {
    return {
      ok: false,
      message: `Sheet length ${sheetLengthInches} in is below this machine’s minimum (${lMin} in).`,
    };
  }
  if (lMax != null && Number.isFinite(lMax) && sheetLengthInches - 1e-9 > lMax) {
    return {
      ok: false,
      message: `Sheet length ${sheetLengthInches} in is above this machine’s maximum (${lMax} in).`,
    };
  }
  return { ok: true };
}
