import type { PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function refreshPurchaseOrderStatus(purchaseOrderId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lines: true },
  });
  if (!po || po.status === "CANCELLED" || po.status === "DRAFT") return;

  let allReceived = true;
  let anyReceived = false;
  for (const line of po.lines) {
    if (line.receivedLinearFeet + 1e-9 < line.orderedLinearFeet) {
      allReceived = false;
    }
    if (line.receivedLinearFeet > 1e-9) {
      anyReceived = true;
    }
  }

  let next: PurchaseOrderStatus = po.status;
  if (allReceived && po.lines.length > 0) {
    next = "RECEIVED";
  } else if (anyReceived) {
    next = "PARTIALLY_RECEIVED";
  } else if (po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED") {
    next = "ORDERED";
  }

  if (next !== po.status) {
    await prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: next },
    });
  }
}
