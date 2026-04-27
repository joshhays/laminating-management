import { NextResponse } from "next/server";
import {
  estimatedFeetForVariance,
  pullHasVarianceVsEstimate,
} from "@/lib/inventory-pull-batch";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.jobFilmAllocation.findMany({
    where: { status: "ALLOCATED" },
    include: {
      filmInventory: true,
      jobTicket: {
        select: {
          id: true,
          jobNumber: true,
          customerCompanyName: true,
        },
      },
    },
    orderBy: [{ jobTicket: { jobNumber: "asc" } }, { passOrder: "asc" }],
  });

  const items = rows.map((a) => {
    const est = estimatedFeetForVariance(a);
    const hasVariance = pullHasVarianceVsEstimate(a.allocatedLinearFeet, a);
    return {
      allocationId: a.id,
      jobTicketId: a.jobTicketId,
      jobNumber: a.jobTicket.jobNumber,
      customerCompanyName: a.jobTicket.customerCompanyName,
      passOrder: a.passOrder,
      filmInventoryId: a.filmInventoryId,
      rollDescription: a.filmInventory.description,
      rollStockKind: a.filmInventory.stockKind,
      rollRemainingLinearFeet: a.filmInventory.remainingLinearFeet,
      estimatedLinearFeetSnapshot: a.estimatedLinearFeetSnapshot,
      estimatedFeetForVariance: est,
      allocatedLinearFeet: a.allocatedLinearFeet,
      hasVarianceVsEstimate: hasVariance,
      suggestedPullLinearFeet: a.allocatedLinearFeet,
    };
  });

  return NextResponse.json({ items, count: items.length });
}
