import { JobTimeActivityKind, type Estimate, type FilmInventory } from "@prisma/client";

type EstimateForFilm = Pick<
  Estimate,
  "quantity" | "estimatedLinearFeet" | "rollWidthSnapshotInches" | "pricePerFilmSquareInch"
> & {
  filmRoll: Pick<FilmInventory, "rollWidth"> | null;
};

/**
 * Linear feet consumed for `sheets` production sheets, from estimate totals (same ratio as quote).
 */
export function linearFeetForSheets(sheets: number, estimate: EstimateForFilm): number | null {
  if (!Number.isFinite(sheets) || sheets < 1) return null;
  const qty = estimate.quantity;
  const estFt = estimate.estimatedLinearFeet;
  if (!Number.isFinite(qty) || qty < 1 || !Number.isFinite(estFt) || estFt <= 0) return null;
  return sheets * (estFt / qty);
}

export function rollWidthInchesForFilmCost(estimate: EstimateForFilm): number | null {
  const snap = estimate.rollWidthSnapshotInches;
  if (snap != null && Number.isFinite(snap) && snap > 0) return snap;
  const rw = estimate.filmRoll?.rollWidth;
  if (rw != null && Number.isFinite(rw) && rw > 0) return rw;
  return null;
}

/** $ from linear feet × roll width × $/MSI (matches JOB_PULL pricing shape). */
export function filmCostUsdFromLinearFeet(
  linearFeet: number,
  rollWidthInches: number,
  pricePerFilmSquareInch: number,
): number {
  if (!Number.isFinite(linearFeet) || linearFeet <= 0) return 0;
  if (!Number.isFinite(rollWidthInches) || rollWidthInches <= 0) return 0;
  if (!Number.isFinite(pricePerFilmSquareInch) || pricePerFilmSquareInch < 0) return 0;
  const sqIn = linearFeet * 12 * rollWidthInches;
  const msi = sqIn / 1000;
  return Math.round(msi * pricePerFilmSquareInch * 100) / 100;
}

export function filmCostUsdForSheetsRun(sheetsRun: number, estimate: EstimateForFilm | null): number {
  if (estimate == null) return 0;
  const feet = linearFeetForSheets(sheetsRun, estimate);
  const rollW = rollWidthInchesForFilmCost(estimate);
  const price = estimate.pricePerFilmSquareInch;
  if (feet == null || rollW == null || price == null || !Number.isFinite(price)) return 0;
  return filmCostUsdFromLinearFeet(feet, rollW, price);
}

type FilmAllocRow = {
  allocatedLinearFeet: number;
  filmInventory: { rollWidth: number; pricePerFilmSquareInch: number };
};

/** Total linear feet across all job film allocations for one run segment (sum of per-roll feet). */
export function totalFilmLinearFeetForRun(
  sheetsRun: number,
  orderQty: number,
  allocations: Array<{ allocatedLinearFeet: number }>,
): number {
  if (sheetsRun < 1 || orderQty < 1 || allocations.length === 0) return 0;
  let ft = 0;
  for (const a of allocations) {
    ft += sheetsRun * (a.allocatedLinearFeet / orderQty);
  }
  return Math.round(ft * 100) / 100;
}

function filmUsdForRunMultiAlloc(sheetsRun: number, orderQty: number, allocations: FilmAllocRow[]): number {
  let total = 0;
  for (const a of allocations) {
    const feet = sheetsRun * (a.allocatedLinearFeet / orderQty);
    const w = a.filmInventory.rollWidth;
    const p = a.filmInventory.pricePerFilmSquareInch;
    total += filmCostUsdFromLinearFeet(feet, w, p);
  }
  return Math.round(total * 100) / 100;
}

/** Sum film $ from completed LINE_TIME logs with sheets recorded. */
export function actualFilmUsdFromRunLogs(
  logs: Array<{
    activityKind: JobTimeActivityKind;
    endedAt: Date | null;
    sheetsRun: number | null;
  }>,
  estimate: EstimateForFilm | null,
  allocations: FilmAllocRow[] | null,
  orderQty: number | null,
): number {
  let total = 0;
  for (const log of logs) {
    if (log.endedAt == null) continue;
    if (log.activityKind !== JobTimeActivityKind.LINE_TIME) continue;
    const n = log.sheetsRun;
    if (n == null || !Number.isFinite(n) || n < 1) continue;
    if (allocations != null && allocations.length > 0 && orderQty != null && orderQty >= 1) {
      total += filmUsdForRunMultiAlloc(n, orderQty, allocations);
    } else if (estimate != null) {
      total += filmCostUsdForSheetsRun(n, estimate);
    }
  }
  return Math.round(total * 100) / 100;
}

/** Sum linear feet (all rolls) for completed run logs. */
export function totalFilmLinearFeetFromRunLogs(
  logs: Array<{
    activityKind: JobTimeActivityKind;
    endedAt: Date | null;
    sheetsRun: number | null;
  }>,
  orderQty: number,
  allocations: Array<{ allocatedLinearFeet: number }>,
): number {
  if (orderQty < 1 || allocations.length === 0) return 0;
  let sum = 0;
  for (const log of logs) {
    if (log.endedAt == null) continue;
    if (log.activityKind !== JobTimeActivityKind.LINE_TIME) continue;
    const n = log.sheetsRun;
    if (n == null || !Number.isFinite(n) || n < 1) continue;
    sum += totalFilmLinearFeetForRun(n, orderQty, allocations);
  }
  return Math.round(sum * 100) / 100;
}
