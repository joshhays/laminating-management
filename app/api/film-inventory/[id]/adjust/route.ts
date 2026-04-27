import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: filmInventoryId } = await params;

  let body: { kind: string; linearFeet?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = String(body.kind ?? "").toUpperCase();
  const linearFeet = Number(body.linearFeet);

  if (kind !== "HARD_COUNT" && kind !== "MANUAL_DEDUCT") {
    return NextResponse.json({ error: "kind must be HARD_COUNT or MANUAL_DEDUCT" }, { status: 400 });
  }
  if (!Number.isFinite(linearFeet) || linearFeet < 0) {
    return NextResponse.json({ error: "linearFeet must be a non-negative number" }, { status: 400 });
  }

  const roll = await prisma.filmInventory.findUnique({ where: { id: filmInventoryId } });
  if (!roll) {
    return NextResponse.json({ error: "Roll not found" }, { status: 404 });
  }

  let newBalance: number;
  let delta: number;
  let note: string;

  if (kind === "HARD_COUNT") {
    newBalance = linearFeet;
    delta = newBalance - roll.remainingLinearFeet;
    note = `Hard count: set to ${newBalance} lin. ft`;
  } else {
    if (linearFeet - 1e-9 > roll.remainingLinearFeet) {
      return NextResponse.json(
        { error: "Deduct amount exceeds remaining on roll" },
        { status: 400 },
      );
    }
    newBalance = roll.remainingLinearFeet - linearFeet;
    delta = -linearFeet;
    note = `Manual deduct: ${linearFeet} lin. ft`;
  }

  const movementType = kind === "HARD_COUNT" ? "HARD_COUNT" : "MANUAL_DEDUCT";

  await prisma.$transaction([
    prisma.filmInventory.update({
      where: { id: filmInventoryId },
      data: { remainingLinearFeet: newBalance },
    }),
    prisma.inventoryMovement.create({
      data: {
        filmInventoryId,
        type: movementType,
        deltaLinearFeet: delta,
        balanceAfterLinearFeet: newBalance,
        note,
      },
    }),
  ]);

  const updated = await prisma.filmInventory.findUnique({ where: { id: filmInventoryId } });
  return NextResponse.json(updated);
}
