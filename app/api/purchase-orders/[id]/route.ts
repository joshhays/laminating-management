import { NextResponse } from "next/server";
import { PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set<string>(Object.values(PurchaseOrderStatus));

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!po) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(po);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json();
    const statusRaw = body.status != null ? String(body.status).toUpperCase() : undefined;
    const reference =
      body.reference !== undefined
        ? String(body.reference ?? "").trim() || null
        : undefined;
    const supplierName =
      body.supplierName !== undefined
        ? String(body.supplierName ?? "").trim() || null
        : undefined;
    const notes =
      body.notes !== undefined ? String(body.notes ?? "").trim() || null : undefined;
    const vendorEmail =
      body.vendorEmail !== undefined
        ? String(body.vendorEmail ?? "").trim() || null
        : undefined;
    const markSent = body.markSent === true;

    if (statusRaw !== undefined && !STATUSES.has(statusRaw)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(statusRaw !== undefined ? { status: statusRaw as PurchaseOrderStatus } : {}),
        ...(reference !== undefined ? { reference } : {}),
        ...(supplierName !== undefined ? { supplierName } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(vendorEmail !== undefined ? { vendorEmail } : {}),
        ...(markSent ? { sentAt: new Date() } : {}),
      },
      include: { lines: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found or invalid" }, { status: 404 });
  }
}
