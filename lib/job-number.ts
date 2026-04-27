import type { Prisma } from "@prisma/client";

const JOB_NUMBER_START = 20000;

/**
 * Assigns sequential `jobNumber` to legacy rows that are still null.
 * Returns the next free integer to assign to a new job in the same transaction.
 */
async function backfillLegacyJobNumbersAndNextFree(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const maxExisting = (await tx.jobTicket.aggregate({ _max: { jobNumber: true } }))._max.jobNumber;
  const maxNum = maxExisting != null && Number.isFinite(maxExisting) ? maxExisting : 0;
  let next = Math.max(JOB_NUMBER_START, maxNum + 1);

  const legacy = await tx.jobTicket.findMany({
    where: { jobNumber: null },
    orderBy: { createdAt: "asc" },
  });
  for (const r of legacy) {
    await tx.jobTicket.update({
      where: { id: r.id },
      data: { jobNumber: next },
    });
    next += 1;
  }
  return next;
}

/** Next display job number for a newly created {@link JobTicket}. */
export async function nextJobNumberForCreate(tx: Prisma.TransactionClient): Promise<number> {
  return backfillLegacyJobNumbersAndNextFree(tx);
}
