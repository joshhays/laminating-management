/** Extra sheets from spoilage % (by sheet count), rounded up. */
export function spoilageAllowanceSheets(quantity: number, spoilagePercent: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  if (!Number.isFinite(spoilagePercent) || spoilagePercent <= 0) return 0;
  const p = Math.min(100, Math.max(0, spoilagePercent));
  return Math.ceil(quantity * (p / 100));
}

export function productionSheetCount(quantity: number, spoilagePercent: number): number {
  return Math.floor(quantity) + spoilageAllowanceSheets(quantity, spoilagePercent);
}
