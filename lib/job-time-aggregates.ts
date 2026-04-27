import type { Prisma } from "@prisma/client";

function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
}

/**
 * Sum completed timer hours on the job. Machine and operator costing both use this same total.
 * (Legacy LABOR_TIME rows still count toward elapsed time; new timers are LINE_TIME only.)
 */
export async function recalcJobTicketActualHours(
  tx: Prisma.TransactionClient,
  jobTicketId: string,
): Promise<{ runHours: number; laborHours: number }> {
  const logs = await tx.jobTimeLog.findMany({
    where: { jobTicketId, endedAt: { not: null } },
  });
  let totalHours = 0;
  for (const log of logs) {
    if (!log.endedAt) continue;
    totalHours += hoursBetween(log.startedAt, log.endedAt);
  }
  const stored = totalHours > 0 ? totalHours : null;
  await tx.jobTicket.update({
    where: { id: jobTicketId },
    data: {
      actualRunTimeHours: stored,
      actualLaborHours: stored,
    },
  });
  return { runHours: totalHours, laborHours: totalHours };
}
