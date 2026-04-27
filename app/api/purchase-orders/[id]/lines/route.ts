import { NextResponse } from "next/server";
import { isActiveFilmMaterialCode, normalizeFilmMaterialCode } from "@/lib/film-material-service";
import { normalizeVendorKey } from "@/lib/film-inventory-rollup";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: purchaseOrderId } = await params;

  let body: {
    filmInventoryId: string;
    orderedLinearFeet?: number;
    materialType?: string;
    description?: string;
    thicknessMil?: number;
    rollWidth?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filmInventoryId = String(body.filmInventoryId ?? "").trim();
  const orderedLinearFeet = Number(body.orderedLinearFeet);
  if (!filmInventoryId) {
    return NextResponse.json({ error: "filmInventoryId is required" }, { status: 400 });
  }
  if (!Number.isFinite(orderedLinearFeet) || orderedLinearFeet <= 0) {
    return NextResponse.json({ error: "orderedLinearFeet must be positive" }, { status: 400 });
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  if (po.status !== "DRAFT") {
    return NextResponse.json({ error: "Can only add lines to draft purchase orders" }, { status: 400 });
  }

  const roll = await prisma.filmInventory.findUnique({ where: { id: filmInventoryId } });
  if (!roll) return NextResponse.json({ error: "Film item not found" }, { status: 404 });

  const vendorRoll = normalizeVendorKey(roll.vendor);
  const vendorPo = normalizeVendorKey(po.supplierName);
  if (vendorPo && vendorRoll && vendorPo !== vendorRoll) {
    return NextResponse.json(
      { error: "Purchase order supplier does not match this film item’s vendor; edit the PO or use a matching draft" },
      { status: 400 },
    );
  }

  const mt = body.materialType != null ? normalizeFilmMaterialCode(String(body.materialType)) : roll.materialType;
  const description =
    body.description != null ? String(body.description).trim() || roll.description : roll.description;
  const thicknessMil =
    body.thicknessMil != null ? Number(body.thicknessMil) : roll.thicknessMil;
  const rollWidth = body.rollWidth != null ? Number(body.rollWidth) : roll.rollWidth;

  if (!(await isActiveFilmMaterialCode(mt))) {
    return NextResponse.json({ error: "Invalid or inactive material type" }, { status: 400 });
  }
  if (
    ![thicknessMil, rollWidth].every((n) => Number.isFinite(n) && n > 0)
  ) {
    return NextResponse.json({ error: "Thickness and roll width must be positive" }, { status: 400 });
  }

  try {
    const line = await prisma.$transaction(async (tx) => {
      if (!vendorPo && roll.vendor?.trim()) {
        await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { supplierName: roll.vendor!.trim() },
        });
      }
      return tx.purchaseOrderLine.create({
        data: {
          purchaseOrderId,
          filmInventoryId: roll.id,
          materialType: mt,
          description,
          thicknessMil,
          rollWidth,
          orderedLinearFeet,
        },
      });
    });

    const full = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });
    return NextResponse.json({ line, purchaseOrder: full }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not add line" }, { status: 400 });
  }
}
