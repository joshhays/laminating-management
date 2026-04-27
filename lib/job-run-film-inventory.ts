import { FilmStockKind, JobFilmAllocationStatus, type Prisma } from "@prisma/client";

const EPS = 1e-6;

export const RUN_FILM_ERROR = {
  INSUFFICIENT_FLOOR_STOCK: "INSUFFICIENT_FLOOR_STOCK",
  OVER_JOB_FILM_BUDGET: "OVER_JOB_FILM_BUDGET",
} as const;

async function sumJobPullFeet(tx: Prisma.TransactionClient, jobTicketId: string, filmInventoryId: string) {
  const rows = await tx.inventoryMovement.findMany({
    where: { jobTicketId, filmInventoryId, type: "JOB_PULL" },
    select: { deltaLinearFeet: true },
  });
  return rows.reduce((s, r) => s + Math.abs(r.deltaLinearFeet), 0);
}

/**
 * When a shop-floor run ends with sheetsRun, deduct film from inventory:
 * - FLOOR_STOCK (not already fully pulled via legacy button): decrement roll by run feet.
 * - CATALOG (job-purchased): treat allocation as job lot size; first consumption converts roll to
 *   FLOOR_STOCK with remaining = budget − cumulative pulls; JOB_PULL movements record usage.
 * Skips double-deduct when legacy Pull film already removed the full allocation from floor stock.
 */
export async function applyRunFilmConsumption(
  tx: Prisma.TransactionClient,
  input: { jobTicketId: string; timeLogId: string; sheetsRun: number },
): Promise<void> {
  const { jobTicketId, timeLogId, sheetsRun } = input;
  if (!Number.isFinite(sheetsRun) || sheetsRun < 1) return;

  const existing = await tx.inventoryMovement.count({ where: { jobTimeLogId: timeLogId } });
  if (existing > 0) return;

  const job = await tx.jobTicket.findUnique({
    where: { id: jobTicketId },
    include: {
      estimate: true,
      filmAllocations: {
        where: { status: { not: "CANCELLED" } },
        include: { filmInventory: true },
        orderBy: { passOrder: "asc" },
      },
    },
  });
  if (!job?.estimate || job.filmAllocations.length === 0) return;

  const orderQty = job.estimate.quantity;
  if (!Number.isFinite(orderQty) || orderQty < 1) return;

  for (const alloc of job.filmAllocations) {
    if (alloc.status === JobFilmAllocationStatus.CANCELLED) continue;

    const runFeet = sheetsRun * (alloc.allocatedLinearFeet / orderQty);
    if (!Number.isFinite(runFeet) || runFeet <= EPS) continue;

    const roll = await tx.filmInventory.findUniqueOrThrow({ where: { id: alloc.filmInventoryId } });
    const pulledBefore = await sumJobPullFeet(tx, jobTicketId, roll.id);

    const legacyFullPullOnFloor =
      alloc.status === JobFilmAllocationStatus.PULLED &&
      roll.stockKind === FilmStockKind.FLOOR_STOCK &&
      pulledBefore + EPS >= alloc.allocatedLinearFeet;

    if (legacyFullPullOnFloor) {
      continue;
    }

    if (roll.stockKind === FilmStockKind.CATALOG) {
      const budget = alloc.allocatedLinearFeet;
      if (pulledBefore + runFeet > budget + EPS) {
        throw new Error(RUN_FILM_ERROR.OVER_JOB_FILM_BUDGET);
      }
      const newRemaining = Math.max(0, budget - pulledBefore - runFeet);
      await tx.filmInventory.update({
        where: { id: roll.id },
        data: {
          stockKind: FilmStockKind.FLOOR_STOCK,
          remainingLinearFeet: newRemaining,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          filmInventoryId: roll.id,
          type: "JOB_PULL",
          deltaLinearFeet: -runFeet,
          balanceAfterLinearFeet: newRemaining,
          jobTicketId,
          jobTimeLogId: timeLogId,
          note: `Run ${timeLogId.slice(0, 8)}… · ${runFeet.toFixed(2)} lin ft (job film → floor stock, ${newRemaining.toFixed(2)} ft left on roll)`,
        },
      });
    } else {
      if (roll.remainingLinearFeet + EPS < runFeet) {
        throw new Error(RUN_FILM_ERROR.INSUFFICIENT_FLOOR_STOCK);
      }
      const newBal = roll.remainingLinearFeet - runFeet;
      await tx.filmInventory.update({
        where: { id: roll.id },
        data: { remainingLinearFeet: newBal },
      });
      await tx.inventoryMovement.create({
        data: {
          filmInventoryId: roll.id,
          type: "JOB_PULL",
          deltaLinearFeet: -runFeet,
          balanceAfterLinearFeet: newBal,
          jobTicketId,
          jobTimeLogId: timeLogId,
          note: `Run ${timeLogId.slice(0, 8)}… · ${runFeet.toFixed(2)} lin ft`,
        },
      });
    }

    const pulledAfter = pulledBefore + runFeet;
    if (
      alloc.status === JobFilmAllocationStatus.ALLOCATED &&
      pulledAfter + EPS >= alloc.allocatedLinearFeet
    ) {
      await tx.jobFilmAllocation.update({
        where: { id: alloc.id },
        data: { status: JobFilmAllocationStatus.PULLED, pulledAt: new Date() },
      });
    }
  }
}
