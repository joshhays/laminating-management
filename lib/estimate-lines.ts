export const MAX_ESTIMATE_LINES = 50;
export const ESTIMATE_LINE_LABEL_MAX = 200;

export type EstimateLineInput = {
  label: string;
  quantity: number;
};

/** Proportional allocation of total cost by sheet quantity; fixes floating drift on the last line. */
export function allocateCostsToLines(
  lines: EstimateLineInput[],
  totalCost: number,
): { label: string; quantity: number; allocatedCostUsd: number }[] {
  if (lines.length === 0) return [];
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  if (totalQty <= 0) return [];
  const safeTotal = Number.isFinite(totalCost) && totalCost >= 0 ? totalCost : 0;
  const out = lines.map((l) => ({
    label: l.label,
    quantity: l.quantity,
    allocatedCostUsd: (safeTotal * l.quantity) / totalQty,
  }));
  const sumAlloc = out.reduce((s, r) => s + r.allocatedCostUsd, 0);
  const drift = safeTotal - sumAlloc;
  if (out.length > 0 && Math.abs(drift) > 1e-9) {
    out[out.length - 1].allocatedCostUsd += drift;
  }
  return out;
}
