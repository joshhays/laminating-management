/** Sheet-fed / inkjet: speed stored as sheets per hour. */
export const PRESS_TYPE_SHEETS_PER_HOUR = "SHEETS_PER_HOUR" as const;
/** Toner / click charge: speed stored as 8.5×11 pages per minute. */
export const PRESS_TYPE_TONER = "TONER" as const;
/** Digital press: JSON matrix (size × sides × GSM → IPM). */
export const PRESS_TYPE_DIGITAL_IPM_MATRIX = "DIGITAL_IPM_MATRIX" as const;

export const PRESS_TYPES = [
  PRESS_TYPE_SHEETS_PER_HOUR,
  PRESS_TYPE_TONER,
  PRESS_TYPE_DIGITAL_IPM_MATRIX,
] as const;
export type PressType = (typeof PRESS_TYPES)[number];

export function normalizePressType(value: string | null | undefined): PressType {
  const u = String(value ?? "").toUpperCase();
  if (u === PRESS_TYPE_TONER) return PRESS_TYPE_TONER;
  if (u === PRESS_TYPE_DIGITAL_IPM_MATRIX) return PRESS_TYPE_DIGITAL_IPM_MATRIX;
  return PRESS_TYPE_SHEETS_PER_HOUR;
}

export type MachineSpeedFields = {
  pressType?: string | null | undefined;
  speedSheetsPerHour?: number | null | undefined;
  speedPagesPerMinute?: number | null | undefined;
  speedMatrixJson?: string | null | undefined;
};

/**
 * Sheets per hour used for run-time math (`sheetsToPress / rate`).
 * TONER: pages/min × 60 (letter impressions/hour).
 * DIGITAL_IPM_MATRIX: returns null (use matrix + impressions instead).
 */
export function effectiveSheetsPerHour(m: MachineSpeedFields | null | undefined): number | null {
  if (!m) return null;
  const type = normalizePressType(m.pressType);
  if (type === PRESS_TYPE_DIGITAL_IPM_MATRIX) return null;
  if (type === PRESS_TYPE_TONER) {
    const ppm = m.speedPagesPerMinute;
    if (ppm == null || ppm <= 0) return null;
    return ppm * 60;
  }
  const sph = m.speedSheetsPerHour;
  if (sph == null || sph <= 0) return null;
  return sph;
}
