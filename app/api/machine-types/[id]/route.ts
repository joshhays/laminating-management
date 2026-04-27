import { MachineTypeKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseKind(raw: unknown): MachineTypeKind | undefined {
  if (raw === undefined) return undefined;
  const t = String(raw).trim().toUpperCase();
  if (t === "CUTTER") return MachineTypeKind.CUTTER;
  if (t === "LAMINATOR") return MachineTypeKind.LAMINATOR;
  if (t === "PRESS") return MachineTypeKind.PRESS;
  if (t === "FINISHING") return MachineTypeKind.FINISHING;
  if (t === "MAILING") return MachineTypeKind.MAILING;
  return undefined;
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name ?? "").trim() : undefined;
    const sortOrder = body.sortOrder !== undefined ? Number(body.sortOrder) : undefined;
    const notes =
      body.notes !== undefined ? String(body.notes ?? "").trim() || null : undefined;
    const kind = body.kind !== undefined ? parseKind(body.kind) : undefined;
    const pressTechnologyRaw =
      body.pressTechnology !== undefined ? String(body.pressTechnology ?? "").trim() || null : undefined;
    const finishingKindRaw =
      body.finishingKind !== undefined ? String(body.finishingKind ?? "").trim() || null : undefined;

    const optNum = (k: string) => {
      if (body[k] === undefined) return undefined;
      if (body[k] === null || String(body[k]).trim() === "") return null;
      return Number(body[k]);
    };

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    const row = await prisma.machineType.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(kind !== undefined ? { kind } : {}),
        ...(pressTechnologyRaw !== undefined ? { pressTechnology: pressTechnologyRaw } : {}),
        ...(finishingKindRaw !== undefined ? { finishingKind: finishingKindRaw } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0 } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(body.defaultMakeReadyMinutes !== undefined
          ? { defaultMakeReadyMinutes: optNum("defaultMakeReadyMinutes") }
          : {}),
        ...(body.defaultSideChangeMinutes !== undefined
          ? { defaultSideChangeMinutes: optNum("defaultSideChangeMinutes") }
          : {}),
        ...(body.defaultWashUpMinutes !== undefined
          ? { defaultWashUpMinutes: optNum("defaultWashUpMinutes") }
          : {}),
        ...(body.defaultSpoilagePercent !== undefined
          ? { defaultSpoilagePercent: optNum("defaultSpoilagePercent") }
          : {}),
        ...(body.defaultMinSheetWidthInches !== undefined
          ? { defaultMinSheetWidthInches: optNum("defaultMinSheetWidthInches") }
          : {}),
        ...(body.defaultMaxSheetWidthInches !== undefined
          ? { defaultMaxSheetWidthInches: optNum("defaultMaxSheetWidthInches") }
          : {}),
        ...(body.defaultMinSheetLengthInches !== undefined
          ? { defaultMinSheetLengthInches: optNum("defaultMinSheetLengthInches") }
          : {}),
        ...(body.defaultMaxSheetLengthInches !== undefined
          ? { defaultMaxSheetLengthInches: optNum("defaultMaxSheetLengthInches") }
          : {}),
      },
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Not found or invalid" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.machineType.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
