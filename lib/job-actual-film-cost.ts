import type { FilmInventory, InventoryMovement } from "@prisma/client";

type MovementWithRoll = InventoryMovement & { filmInventory: FilmInventory };

/**
 * Film $ from JOB_PULL movements: linear feet × (12 in/ft × roll width in) sq in ÷ 1000 × $/MSI.
 */
export function actualFilmCostUsdFromMovements(movements: MovementWithRoll[]): number {
  let total = 0;
  for (const m of movements) {
    if (m.type !== "JOB_PULL") continue;
    const feet = Math.abs(m.deltaLinearFeet);
    if (!Number.isFinite(feet) || feet <= 0) continue;
    const w = m.filmInventory.rollWidth;
    const priceMsi = m.filmInventory.pricePerFilmSquareInch;
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(priceMsi) || priceMsi < 0) continue;
    const sqIn = feet * 12 * w;
    const msi = sqIn / 1000;
    total += msi * priceMsi;
  }
  return Math.round(total * 100) / 100;
}
