import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.shopFloorEmployee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, pinHash: true },
  });
  return NextResponse.json(
    rows.map(({ id, name, pinHash }) => ({
      id,
      name,
      requiresPin: pinHash != null && pinHash.length > 0,
    })),
  );
}

export async function POST(request: Request) {
  let body: { name?: string; pin?: string | null };
  try {
    body = (await request.json()) as { name?: string; pin?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const existing = await prisma.shopFloorEmployee.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "An employee with this name already exists" }, { status: 409 });
  }
  const pinRaw = body.pin != null ? String(body.pin).trim() : "";
  const pinHash =
    pinRaw.length > 0 ? await bcrypt.hash(pinRaw, 10) : null;

  const emp = await prisma.shopFloorEmployee.create({
    data: { name, pinHash },
    select: { id: true, name: true },
  });
  return NextResponse.json(emp, { status: 201 });
}
