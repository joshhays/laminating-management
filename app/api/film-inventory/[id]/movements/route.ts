import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const roll = await prisma.filmInventory.findUnique({ where: { id } });
  if (!roll) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const movements = await prisma.inventoryMovement.findMany({
    where: { filmInventoryId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(movements);
}
