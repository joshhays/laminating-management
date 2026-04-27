import { FilmStockKind, JobWorkflowStatus, type Prisma } from "@prisma/client";

/** Ordered linear stages (index = progress). */
export const WORKFLOW_ORDER: JobWorkflowStatus[] = [
  JobWorkflowStatus.DRAFT,
  JobWorkflowStatus.QUOTED,
  JobWorkflowStatus.AWARDED,
  JobWorkflowStatus.PURCHASING,
  JobWorkflowStatus.PRODUCTION,
  JobWorkflowStatus.SHIPPING,
  JobWorkflowStatus.COMPLETE,
];

const LABELS: Record<JobWorkflowStatus, string> = {
  DRAFT: "Draft",
  QUOTED: "Quoted",
  AWARDED: "Awarded",
  PURCHASING: "Purchasing",
  PRODUCTION: "Production",
  SHIPPING: "Shipping",
  COMPLETE: "Complete",
};

const NEXT_ACTION: Partial<Record<JobWorkflowStatus, string>> = {
  DRAFT: "Send quote",
  QUOTED: "Approve quote",
  AWARDED: "Start purchasing",
  PURCHASING: "Start production",
  PRODUCTION: "Ready to ship",
  SHIPPING: "Mark complete",
};

export function workflowLabel(s: JobWorkflowStatus): string {
  return LABELS[s] ?? s;
}

export function workflowNextActionLabel(s: JobWorkflowStatus): string | null {
  if (s === JobWorkflowStatus.COMPLETE) return null;
  return NEXT_ACTION[s] ?? "Advance";
}

export function workflowIndex(s: JobWorkflowStatus): number {
  return WORKFLOW_ORDER.indexOf(s);
}

export function nextWorkflowStatus(current: JobWorkflowStatus): JobWorkflowStatus | null {
  const i = workflowIndex(current);
  if (i < 0 || i >= WORKFLOW_ORDER.length - 1) return null;
  return WORKFLOW_ORDER[i + 1] ?? null;
}

export function isWorkflowLocked(params: {
  workflowStatus: JobWorkflowStatus;
  workflowLockedAt: Date | null;
}): boolean {
  return (
    params.workflowStatus === JobWorkflowStatus.COMPLETE || params.workflowLockedAt != null
  );
}

const EPS = 1e-9;

/**
 * Creates purchase requirement rows for floor rolls that cannot cover allocated film.
 */
export async function ensurePurchaseRequirementsForLowStock(
  tx: Prisma.TransactionClient,
  jobTicketId: string,
): Promise<number> {
  await tx.purchaseRequirement.deleteMany({ where: { jobTicketId } });

  const allocs = await tx.jobFilmAllocation.findMany({
    where: { jobTicketId, status: "ALLOCATED" },
    include: { filmInventory: true },
  });

  let created = 0;
  for (const a of allocs) {
    const roll = a.filmInventory;
    if (roll.stockKind === FilmStockKind.CATALOG) {
      continue;
    }
    if (roll.remainingLinearFeet + EPS < a.allocatedLinearFeet) {
      const short = Math.max(0, a.allocatedLinearFeet - roll.remainingLinearFeet);
      await tx.purchaseRequirement.create({
        data: {
          jobTicketId,
          filmInventoryId: roll.id,
          description: `Floor stock low on “${roll.description}” (${roll.remainingLinearFeet.toFixed(1)} ft on hand; ${a.allocatedLinearFeet.toFixed(1)} ft needed).`,
          linearFeetShort: short,
        },
      });
      created += 1;
    }
  }

  return created;
}
