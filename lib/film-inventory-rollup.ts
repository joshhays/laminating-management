import {
  JobFilmAllocationStatus,
  PurchaseOrderStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

const OPEN_PO_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"];

export function normalizeVendorKey(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export type FilmRollRollup = {
  inEstimateCount: number;
  allocatedToJobLinearFeet: number;
  onOrderOpenLinearFeet: number;
  onHandLinearFeet: number;
  availableLinearFeet: number;
};

export async function filmRollupMapForIds(
  db: PrismaClient | Prisma.TransactionClient,
  rows: Array<{ id: string; remainingLinearFeet: number }>,
): Promise<Map<string, FilmRollRollup>> {
  const uniq = new Map<string, number>();
  for (const r of rows) {
    uniq.set(r.id, r.remainingLinearFeet);
  }
  const ids = [...uniq.keys()];
  if (ids.length === 0) return new Map();

  const [primEst, secEst, allocGrp, poLines] = await Promise.all([
    db.estimate.groupBy({
      by: ["filmInventoryId"],
      where: { filmInventoryId: { in: ids } },
      _count: { _all: true },
    }),
    db.estimate.groupBy({
      by: ["secondFilmInventoryId"],
      where: { secondFilmInventoryId: { in: ids } },
      _count: { _all: true },
    }),
    db.jobFilmAllocation.groupBy({
      by: ["filmInventoryId"],
      where: {
        filmInventoryId: { in: ids },
        status: JobFilmAllocationStatus.ALLOCATED,
      },
      _sum: { allocatedLinearFeet: true },
    }),
    db.purchaseOrderLine.findMany({
      where: { filmInventoryId: { in: ids } },
      select: {
        filmInventoryId: true,
        orderedLinearFeet: true,
        receivedLinearFeet: true,
        purchaseOrder: { select: { status: true } },
      },
    }),
  ]);

  const estCount = new Map<string, number>();
  for (const g of primEst) {
    if (g.filmInventoryId) {
      estCount.set(g.filmInventoryId, (estCount.get(g.filmInventoryId) ?? 0) + g._count._all);
    }
  }
  for (const g of secEst) {
    if (g.secondFilmInventoryId) {
      estCount.set(
        g.secondFilmInventoryId,
        (estCount.get(g.secondFilmInventoryId) ?? 0) + g._count._all,
      );
    }
  }

  const allocSum = new Map<string, number>();
  for (const g of allocGrp) {
    if (g.filmInventoryId != null) {
      allocSum.set(g.filmInventoryId, g._sum.allocatedLinearFeet ?? 0);
    }
  }

  const onOrder = new Map<string, number>();
  for (const line of poLines) {
    if (!line.filmInventoryId) continue;
    if (!OPEN_PO_STATUSES.includes(line.purchaseOrder.status)) continue;
    const open = Math.max(0, line.orderedLinearFeet - line.receivedLinearFeet);
    onOrder.set(line.filmInventoryId, (onOrder.get(line.filmInventoryId) ?? 0) + open);
  }

  const result = new Map<string, FilmRollRollup>();
  for (const id of ids) {
    const onHand = uniq.get(id) ?? 0;
    const allocated = allocSum.get(id) ?? 0;
    const inEst = estCount.get(id) ?? 0;
    const ord = onOrder.get(id) ?? 0;
    result.set(id, {
      inEstimateCount: inEst,
      allocatedToJobLinearFeet: Math.round(allocated * 100) / 100,
      onOrderOpenLinearFeet: Math.round(ord * 100) / 100,
      onHandLinearFeet: Math.round(onHand * 100) / 100,
      availableLinearFeet: Math.round(Math.max(0, onHand - allocated) * 100) / 100,
    });
  }
  return result;
}

export type FilmShortfallLine = {
  allocationId: string;
  filmInventoryId: string;
  description: string;
  vendor: string | null;
  stockKind: string;
  needLinearFeet: number;
  onHandLinearFeet: number;
  onOrderOpenLinearFeet: number;
  suggestPurchaseLinearFeet: number;
};

export async function getFilmShortfallForJob(
  db: PrismaClient,
  jobTicketId: string,
): Promise<{ lines: FilmShortfallLine[] } | null> {
  const job = await db.jobTicket.findUnique({
    where: { id: jobTicketId },
    include: {
      filmAllocations: {
        where: { status: { not: JobFilmAllocationStatus.CANCELLED } },
        include: { filmInventory: true },
        orderBy: { passOrder: "asc" },
      },
    },
  });
  if (!job) return null;

  const rollupInput = job.filmAllocations.map((a) => ({
    id: a.filmInventoryId,
    remainingLinearFeet: a.filmInventory.remainingLinearFeet,
  }));
  const rollup = await filmRollupMapForIds(db, rollupInput);

  const lines: FilmShortfallLine[] = [];
  for (const alloc of job.filmAllocations) {
    const roll = alloc.filmInventory;
    const need = alloc.allocatedLinearFeet;
    const r = rollup.get(roll.id);
    if (!r) continue;

    const shortVsHand = Math.max(0, need - roll.remainingLinearFeet);
    const stillNeed = Math.max(0, shortVsHand - r.onOrderOpenLinearFeet);

    if (stillNeed > 1e-6) {
      lines.push({
        allocationId: alloc.id,
        filmInventoryId: roll.id,
        description: roll.description,
        vendor: roll.vendor,
        stockKind: roll.stockKind,
        needLinearFeet: Math.round(need * 100) / 100,
        onHandLinearFeet: Math.round(roll.remainingLinearFeet * 100) / 100,
        onOrderOpenLinearFeet: r.onOrderOpenLinearFeet,
        suggestPurchaseLinearFeet: Math.round(stillNeed * 100) / 100,
      });
    }
  }

  return { lines };
}

export type FilmRollUsageDetail = FilmRollRollup & {
  filmInventoryId: string;
  estimates: Array<{ id: string; estimateNumber: number | null }>;
  jobs: Array<{
    jobTicketId: string;
    jobNumber: number | null;
    allocationId: string;
    passOrder: number;
    allocatedLinearFeet: number;
    status: string;
  }>;
  purchaseOrders: Array<{
    purchaseOrderId: string;
    reference: string | null;
    supplierName: string | null;
    status: PurchaseOrderStatus;
    lineId: string;
    orderedLinearFeet: number;
    receivedLinearFeet: number;
    openLinearFeet: number;
  }>;
};

export async function getFilmRollUsageDetail(
  db: PrismaClient,
  filmInventoryId: string,
): Promise<FilmRollUsageDetail | null> {
  const roll = await db.filmInventory.findUnique({ where: { id: filmInventoryId } });
  if (!roll) return null;

  const rollup = await filmRollupMapForIds(db, [
    { id: roll.id, remainingLinearFeet: roll.remainingLinearFeet },
  ]);
  const base = rollup.get(roll.id)!;
  const [estimates, allocations, lines] = await Promise.all([
    db.estimate.findMany({
      where: {
        OR: [{ filmInventoryId }, { secondFilmInventoryId: filmInventoryId }],
      },
      select: { id: true, estimateNumber: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.jobFilmAllocation.findMany({
      where: { filmInventoryId },
      include: {
        jobTicket: { select: { id: true, jobNumber: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.purchaseOrderLine.findMany({
      where: { filmInventoryId },
      include: {
        purchaseOrder: { select: { id: true, reference: true, supplierName: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    filmInventoryId: roll.id,
    ...base,
    estimates,
    jobs: allocations.map((a) => ({
      jobTicketId: a.jobTicket.id,
      jobNumber: a.jobTicket.jobNumber,
      allocationId: a.id,
      passOrder: a.passOrder,
      allocatedLinearFeet: a.allocatedLinearFeet,
      status: a.status,
    })),
    purchaseOrders: lines.map((ln) => ({
      purchaseOrderId: ln.purchaseOrder.id,
      reference: ln.purchaseOrder.reference,
      supplierName: ln.purchaseOrder.supplierName,
      status: ln.purchaseOrder.status,
      lineId: ln.id,
      orderedLinearFeet: ln.orderedLinearFeet,
      receivedLinearFeet: ln.receivedLinearFeet,
      openLinearFeet: Math.max(0, ln.orderedLinearFeet - ln.receivedLinearFeet),
    })),
  };
}
