import { MachineTypeKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseKind(raw: unknown): MachineTypeKind {
  const t = String(raw ?? "LAMINATOR")
    .trim()
    .toUpperCase();
  if (t === "CUTTER") return MachineTypeKind.CUTTER;
  if (t === "PRESS") return MachineTypeKind.PRESS;
  if (t === "FINISHING") return MachineTypeKind.FINISHING;
  if (t === "MAILING") return MachineTypeKind.MAILING;
  return MachineTypeKind.LAMINATOR;
}

const PRESS_TECH = ["OFFSET", "TONER", "INKJET"] as const;
const FINISHING_KINDS = ["CUTTER", "FOLDER", "BINDER", "OTHER"] as const;

function normalizePressTechnology(raw: unknown): string | null {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t) return null;
  return PRESS_TECH.includes(t as (typeof PRESS_TECH)[number]) ? t : null;
}

function normalizeFinishingKind(raw: unknown): string | null {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t) return null;
  return FINISHING_KINDS.includes(t as (typeof FINISHING_KINDS)[number]) ? t : null;
}

export async function GET() {
  const list = await prisma.machineType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const sortOrder = Number(body.sortOrder ?? 0);
    const notes = body.notes != null ? String(body.notes).trim() || null : null;
    const kind = parseKind(body.kind);
    let pressTechnology: string | null = null;
    let finishingKind: string | null = null;

    if (kind === MachineTypeKind.PRESS) {
      pressTechnology = normalizePressTechnology(body.pressTechnology);
      if (!pressTechnology) {
        return NextResponse.json(
          { error: "Press types need a technology: OFFSET, TONER, or INKJET." },
          { status: 400 },
        );
      }
    }
    if (kind === MachineTypeKind.FINISHING) {
      finishingKind = normalizeFinishingKind(body.finishingKind);
      if (!finishingKind) {
        return NextResponse.json(
          { error: "Finishing types need a subtype: CUTTER, FOLDER, BINDER, or OTHER." },
          { status: 400 },
        );
      }
    }

    const num = (k: string) =>
      body[k] !== undefined && body[k] !== null && String(body[k]).trim() !== ""
        ? Number(body[k])
        : null;

    const row = await prisma.machineType.create({
      data: {
        name,
        kind,
        pressTechnology,
        finishingKind,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        notes,
        defaultMakeReadyMinutes: num("defaultMakeReadyMinutes"),
        defaultSideChangeMinutes: num("defaultSideChangeMinutes"),
        defaultWashUpMinutes: num("defaultWashUpMinutes"),
        defaultSpoilagePercent: num("defaultSpoilagePercent"),
        defaultMinSheetWidthInches: num("defaultMinSheetWidthInches"),
        defaultMaxSheetWidthInches: num("defaultMaxSheetWidthInches"),
        defaultMinSheetLengthInches: num("defaultMinSheetLengthInches"),
        defaultMaxSheetLengthInches: num("defaultMaxSheetLengthInches"),
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
