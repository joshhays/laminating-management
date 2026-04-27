/** Web travel is along sheet length (feed direction). */

const INCH_TO_M = 0.0254;

/**
 * Theoretical line throughput: (m/min) / (sheet length in m) × 60.
 * Returns null if inputs are invalid or speed is zero.
 */
export function sheetsPerHourFromMpm(
  metersPerMinute: number,
  sheetLengthInches: number,
): number | null {
  if (!Number.isFinite(metersPerMinute) || metersPerMinute <= 0) return null;
  if (!Number.isFinite(sheetLengthInches) || sheetLengthInches <= 0) return null;
  const sheetM = sheetLengthInches * INCH_TO_M;
  return (metersPerMinute / sheetM) * 60;
}

export function formatSheetsPerHour(sph: number): string {
  if (!Number.isFinite(sph) || sph <= 0) return "—";
  if (sph >= 1000) return `${Math.round(sph).toLocaleString()} sph`;
  if (sph >= 100) return `${Math.round(sph)} sph`;
  return `${sph.toFixed(1)} sph`;
}
