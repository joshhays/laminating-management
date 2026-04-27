import {
  DEFAULT_GSM_WHEN_UNKNOWN,
  digitalPressRunMinutes,
  parseSpeedMatrix,
} from "@/lib/print-scheduler/digital-press-speed-matrix";
import { estimateGsmFromStockDescription } from "@/lib/print-scheduler/paper-from-stock";
import {
  effectiveSheetsPerHour,
  normalizePressType,
  PRESS_TYPE_DIGITAL_IPM_MATRIX,
} from "@/lib/print-scheduler/press-speed";
import { parseRunSheetInches, sheetSizeBucket } from "@/lib/print-scheduler/sheet-format";

const MIN_MINUTES = 15;

/**
 * Estimated run time in minutes from sheet count and effective press throughput (sheets/hour).
 */
export function estimateRunMinutes(
  sheetsToPress: number | null | undefined,
  speedSheetsPerHour: number | null | undefined,
): number | null {
  if (
    sheetsToPress == null ||
    speedSheetsPerHour == null ||
    sheetsToPress <= 0 ||
    speedSheetsPerHour <= 0
  ) {
    return null;
  }
  const hours = sheetsToPress / speedSheetsPerHour;
  return Math.max(MIN_MINUTES, Math.ceil(hours * 60));
}

export type MachineForPlacement = {
  pressType?: string | null;
  speedSheetsPerHour?: number | null;
  speedPagesPerMinute?: number | null;
  speedMatrixJson?: string | null;
};

export type PlacementContext = {
  sheetsToPress: number | null | undefined;
  runSheetSize?: string | null;
  stockDescription?: string | null;
  duplex?: boolean | null;
  paperGsm?: number | null;
};

/**
 * Calendar placement duration: digital IPM matrix (stock + size + duplex) or legacy sheets/hr / toner.
 */
export function estimatePlacementMinutes(
  machine: MachineForPlacement | null | undefined,
  ctx: PlacementContext,
): number | null {
  const sheets = ctx.sheetsToPress;
  if (sheets == null || sheets <= 0) return null;
  if (!machine) return null;

  const type = normalizePressType(machine.pressType);
  if (type === PRESS_TYPE_DIGITAL_IPM_MATRIX) {
    const matrix = parseSpeedMatrix(machine.speedMatrixJson);
    if (!matrix) return null;
    const dims = parseRunSheetInches(ctx.runSheetSize);
    const size = dims ? sheetSizeBucket(dims.w, dims.h) : "LARGE";
    const gsm =
      ctx.paperGsm != null && ctx.paperGsm > 0
        ? ctx.paperGsm
        : (estimateGsmFromStockDescription(ctx.stockDescription) ?? DEFAULT_GSM_WHEN_UNKNOWN);
    const duplex = ctx.duplex === true;
    const rawMin = digitalPressRunMinutes({
      matrix,
      finishedSheets: sheets,
      duplex,
      size,
      gsm,
    });
    if (rawMin == null || !Number.isFinite(rawMin)) return null;
    return Math.max(MIN_MINUTES, Math.ceil(rawMin));
  }

  return estimateRunMinutesForMachine(sheets, machine);
}

/** Uses press type: toner (pages/min) vs sheets/hour. */
export function estimateRunMinutesForMachine(
  sheetsToPress: number | null | undefined,
  machine: MachineForPlacement | null | undefined,
): number | null {
  return estimateRunMinutes(sheetsToPress, effectiveSheetsPerHour(machine ?? null));
}

export type { PressType } from "@/lib/print-scheduler/press-speed";
