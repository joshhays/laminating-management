import { NextResponse } from "next/server";
import { normalizeVendorKey } from "@/lib/film-inventory-rollup";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const vendor = new URL(request.url).searchParams.get("vendor");
  if (!vendor?.trim()) {
    return NextResponse.json({ error: "vendor query parameter is required" }, { status: 400 });
  }
  const key = normalizeVendorKey(vendor);
  const drafts = await prisma.purchaseOrder.findMany({
    where: { status: "DRAFT" },
    include: { lines: true },
    orderBy: { updatedAt: "desc" },
  });
  const filtered = drafts.filter((o) => normalizeVendorKey(o.supplierName) === key);
  return NextResponse.json(filtered);
}
