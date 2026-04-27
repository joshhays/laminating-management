/**
 * Quantity-tiered spoilage for machines. Rules are evaluated in ascending sortOrder;
 * the first rule whose range contains the order quantity and whose paper basis matches wins.
 */

export type SpoilagePaperBasisLower = "text" | "cover";

export type SpoilageRuleInput = {
  sortOrder: number;
  quantityMin: number | null;
  quantityMax: number | null;
  spoilagePercent: number;
  /** Prisma: SpoilagePaperBasis — null/undefined = any stock basis */
  paperBasis?: "TEXT" | "COVER" | null;
};

export type SpoilageResolutionOptions = {
  /** From stock category / grade: text, cover, or unknown (only “any basis” rules match when null). */
  paperBasis?: SpoilagePaperBasisLower | null;
  /** Two-sided lamination: effective spoilage = base × 1.5 (50% added), capped at 100%. */
  secondPass?: boolean;
};

/** Two-sided jobs add 50% of the resolved spoilage percentage (×1.5 overall). */
export function applySecondPassSpoilageFactor(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return clampPercent(percent);
  return clampPercent(percent * 1.5);
}

/**
 * @param quantity — order sheet count (integer sheets)
 * @param rules — typically from DB, any order (sorted internally)
 * @param fallbackPercent — Machine.spoilagePercent when no rule matches
 */
export function spoilagePercentForQuantity(
  quantity: number,
  rules: SpoilageRuleInput[],
  fallbackPercent: number,
  options?: SpoilageResolutionOptions,
): number {
  const q = Math.floor(Number(quantity));
  if (!Number.isFinite(q) || q < 1) {
    return finalizeSpoilage(clampPercent(fallbackPercent), options?.secondPass);
  }

  const jobBasis = options?.paperBasis ?? null;
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const r of sorted) {
    if (!rulePaperBasisMatches(r.paperBasis, jobBasis)) continue;

    const min = r.quantityMin != null && r.quantityMin >= 1 ? r.quantityMin : 1;
    const max =
      r.quantityMax != null && Number.isFinite(r.quantityMax) ? r.quantityMax : Number.POSITIVE_INFINITY;
    if (min > max) continue;
    if (q >= min && q <= max) {
      return finalizeSpoilage(clampPercent(r.spoilagePercent), options?.secondPass);
    }
  }

  return finalizeSpoilage(clampPercent(fallbackPercent), options?.secondPass);
}

function rulePaperBasisMatches(
  ruleBasis: SpoilageRuleInput["paperBasis"],
  jobBasis: SpoilagePaperBasisLower | null,
): boolean {
  if (ruleBasis == null) return true;
  if (jobBasis == null) return false;
  if (ruleBasis === "TEXT") return jobBasis === "text";
  if (ruleBasis === "COVER") return jobBasis === "cover";
  return false;
}

function finalizeSpoilage(percent: number, secondPass?: boolean): number {
  if (secondPass) return applySecondPassSpoilageFactor(percent);
  return percent;
}

function clampPercent(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.min(100, p);
}
