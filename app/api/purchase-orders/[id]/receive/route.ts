import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshPurchaseOrderStatus } from "@/lib/purchase-order-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: purchaseOrderId } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lines: true },
  });

  if (!po) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }
  if (po.status === "CANCELLED" || po.status === "DRAFT") {
    return NextResponse.json(
      { error: "Set status to Ordered before receiving" },
      { status: 400 },
    );
  }

  let body: { receipts: { purchaseOrderLineId: string; linearFeetReceived: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.receipts) || body.receipts.length === 0) {
    return NextResponse.json({ error: "receipts array required" }, { status: 400 });
  }

  const createdRollIds: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const r of body.receipts) {
        const lineId = String(r.purchaseOrderLineId ?? "");
        const qty = Number(r.linearFeetReceived);
        if (!lineId || !Number.isFinite(qty) || qty <= 0) {
          throw new Error("Each receipt needs purchaseOrderLineId and positive linearFeetReceived");
        }

        const line = await tx.purchaseOrderLine.findFirst({
          where: { id: lineId, purchaseOrderId },
        });
        if (!line) {
          throw new Error(`Line ${lineId} is not on this purchase order`);
        }

        const remainingOnOrder = line.orderedLinearFeet - line.receivedLinearFeet;
        if (qty - 1e-9 > remainingOnOrder) {
          throw new Error(
            `Receive qty exceeds open quantity on line (${remainingOnOrder.toFixed(2)} lin. ft left)`,
          );
        }

        if (line.filmInventoryId) {
          const target = await tx.filmInventory.findUnique({
            where: { id: line.filmInventoryId },
          });
          if (!target) {
            throw new Error("Linked film item no longer exists");
          }
          const newBal = target.remainingLinearFeet + qty;
          await tx.filmInventory.update({
            where: { id: target.id },
            data: {
              remainingLinearFeet: newBal,
              stockKind: "FLOOR_STOCK",
              ...(po.supplierName?.trim() && !target.vendor?.trim()
                ? { vendor: po.supplierName.trim() }
                : {}),
            },
          });
          await tx.inventoryMovement.create({
            data: {
              filmInventoryId: target.id,
              type: "PO_RECEIVE",
              deltaLinearFeet: qty,
              balanceAfterLinearFeet: newBal,
              purchaseOrderLineId: line.id,
              note: `Received on PO ${purchaseOrderId.slice(0, 8)}… (added to existing roll)`,
            },
          });
          createdRollIds.push(target.id);
        } else {
          const roll = await tx.filmInventory.create({
            data: {
              rollWidth: line.rollWidth,
              thicknessMil: line.thicknessMil,
              materialType: line.materialType,
              description: line.description,
              stockKind: "FLOOR_STOCK",
              vendor: po.supplierName?.trim() || null,
              remainingLinearFeet: qty,
              pricePerFilmSquareInch: 0,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              filmInventoryId: roll.id,
              type: "PO_RECEIVE",
              deltaLinearFeet: qty,
              balanceAfterLinearFeet: qty,
              purchaseOrderLineId: line.id,
              note: `Received on PO ${purchaseOrderId.slice(0, 8)}…`,
            },
          });
          createdRollIds.push(roll.id);
        }

        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedLinearFeet: { increment: qty } },
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Receive failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await refreshPurchaseOrderStatus(purchaseOrderId);

  return NextResponse.json({ ok: true, createdRollIds }, { status: 201 });
}
