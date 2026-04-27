import type { Prisma } from "@prisma/client";

const ESTIMATE_NUMBER_START = 10000;

/**
 * Assigns sequential `estimateNumber` to any legacy rows that are still null.
 * Returns the next free integer strictly after all assigned estimate numbers.
 */
async function backfillLegacyEstimateNumbersAndNextFree(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const maxExisting = (
    await tx.estimate.aggregate({ _max: { estimateNumber: true } })
  )._max.estimateNumber;

  const maxNum = maxExisting != null && Number.isFinite(maxExisting) ? maxExisting : 0;
  let next = Math.max(ESTIMATE_NUMBER_START, maxNum + 1);

  const legacy = await tx.estimate.findMany({
    where: { estimateNumber: null },
    orderBy: { createdAt: "asc" },
  });
  for (const r of legacy) {
    await tx.estimate.update({
      where: { id: r.id },
      data: { estimateNumber: next },
    });
    next += 1;
  }
  return next;
}

/**
 * Backfills any rows missing `estimateNumber`, then returns the next number for a new estimate.
 * All assigned numbers are ≥ {@link ESTIMATE_NUMBER_START} when there is no higher existing value.
 */
export async function nextEstimateNumberForCreate(
  tx: Prisma.TransactionClient,
): Promise<number> {
  return backfillLegacyEstimateNumbersAndNextFree(tx);
}

/**
 * Next quote display number for a new {@link EstimateBundle} — same numeric sequence as
 * {@link nextEstimateNumberForCreate} so bundles and standalone estimates share one counter.
 */
export async function nextBundleQuoteNumberForCreate(
  tx: Prisma.TransactionClient,
): Promise<number> {
  await backfillLegacyEstimateNumbersAndNextFree(tx);
  const estMax = (
    await tx.estimate.aggregate({ _max: { estimateNumber: true } })
  )._max.estimateNumber;
  const bundleMax = (
    await tx.estimateBundle.aggregate({ _max: { quoteNumber: true } })
  )._max.quoteNumber;
  const e = estMax != null && Number.isFinite(estMax) ? estMax : 0;
  const u = bundleMax != null && Number.isFinite(bundleMax) ? bundleMax : 0;
  return Math.max(ESTIMATE_NUMBER_START, Math.max(e, u) + 1);
}
