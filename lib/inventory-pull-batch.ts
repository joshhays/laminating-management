import type { Prisma } from "@prisma/client";

export const PULL_EPS = 1e-6;

export function estimatedFeetForVariance(alloc: {
  estimatedLinearFeetSnapshot: number | null;
  allocatedLinearFeet: number;
}): number {
  return alloc.estimatedLinearFeetSnapshot ?? alloc.allocatedLinearFeet;
}

export function pullHasVarianceVsEstimate(
  pullLinearFeet: number,
  alloc: { estimatedLinearFeetSnapshot: number | null; allocatedLinearFeet: number },
): boolean {
  const est = estimatedFeetForVariance(alloc);
  return Math.abs(pullLinearFeet - est) > PULL_EPS;
}

/**
 * Applies end-of-day pull for one allocation: updates allocated feet to pull amount, marks PULLED,
 * deducts floor stock and records movement (catalog rolls skip deduction).
 */
export async function pullFilmForAllocation(
  tx: Prisma.TransactionClient,
  input: {
    allocationId: string;
    pullLinearFeet: number;
    /** Defaults to batch wording; pass for per-job pull button. */
    movementNote?: string;
  },
): Promise<{ jobTicketId: string }> {
  const { allocationId, pullLinearFeet, movementNote } = input;
  if (!Number.isFinite(pullLinearFeet) || pullLinearFeet <= PULL_EPS) {
    throw new Error("INVALID_PULL_FEET");
  }

  const alloc = await tx.jobFilmAllocation.findUnique({
    where: { id: allocationId },
    include: { filmInventory: true },
  });
  if (!alloc) throw new Error("ALLOCATION_NOT_FOUND");
  if (alloc.status !== "ALLOCATED") throw new Error("ALLOCATION_NOT_PENDING");

  const roll = alloc.filmInventory;
  if (roll.stockKind !== "CATALOG") {
    if (roll.remainingLinearFeet + PULL_EPS < pullLinearFeet) {
      throw new Error("INSUFFICIENT_STOCK");
    }
  }

  await tx.jobFilmAllocation.update({
    where: { id: alloc.id },
    data: {
      allocatedLinearFeet: pullLinearFeet,
      status: "PULLED",
      pulledAt: new Date(),
    },
  });

  if (roll.stockKind === "CATALOG") {
    return { jobTicketId: alloc.jobTicketId };
  }

  const newBal = roll.remainingLinearFeet - pullLinearFeet;
  await tx.filmInventory.update({
    where: { id: roll.id },
    data: { remainingLinearFeet: newBal },
  });
  const note =
    movementNote ??
    `Batch pull · job ${alloc.jobTicketId.slice(0, 8)}… (${pullLinearFeet.toFixed(2)} lin. ft)`;
  await tx.inventoryMovement.create({
    data: {
      filmInventoryId: roll.id,
      type: "JOB_PULL",
      deltaLinearFeet: -pullLinearFeet,
      balanceAfterLinearFeet: newBal,
      jobTicketId: alloc.jobTicketId,
      note,
    },
  });

  return { jobTicketId: alloc.jobTicketId };
}
