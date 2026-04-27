import { NextResponse } from "next/server";
import { SpoilagePaperBasis } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

type RuleInput = {
  sortOrder?: number;
  name?: string | null;
  paperBasis?: string | null;
  quantityMin?: number | string | null;
  quantityMax?: number | string | null;
  spoilagePercent: number | string;
};

function optInt(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isInteger(n) ? n : Number.NaN;
}

function optName(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

function optPaperBasis(v: unknown): SpoilagePaperBasis | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim().toUpperCase();
  if (s === "TEXT") return SpoilagePaperBasis.TEXT;
  if (s === "COVER") return SpoilagePaperBasis.COVER;
  return null;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: machineId } = await params;
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }
  const rules = await prisma.machineSpoilageRule.findMany({
    where: { machineId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(rules);
}

export async function PUT(request: Request, { params }: Params) {
  const { id: machineId } = await params;

  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }

  let body: { rules: RuleInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.rules)) {
    return NextResponse.json({ error: "rules array required" }, { status: 400 });
  }

  const normalized: {
    sortOrder: number;
    name: string | null;
    paperBasis: SpoilagePaperBasis | null;
    quantityMin: number | null;
    quantityMax: number | null;
    spoilagePercent: number;
  }[] = [];

  for (let i = 0; i < body.rules.length; i++) {
    const r = body.rules[i];
    const sortOrder = r.sortOrder !== undefined ? Number(r.sortOrder) : i;
    const spoilagePercent = Number(r.spoilagePercent);

    const quantityMin = optInt(r.quantityMin);
    const quantityMax = optInt(r.quantityMax);

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: `Rule ${i + 1}: invalid sort order` }, { status: 400 });
    }
    if (!Number.isFinite(spoilagePercent) || spoilagePercent < 0 || spoilagePercent > 100) {
      return NextResponse.json(
        { error: `Rule ${i + 1}: spoilage % must be between 0 and 100` },
        { status: 400 },
      );
    }

    if (quantityMin !== null && Number.isNaN(quantityMin)) {
      return NextResponse.json({ error: `Rule ${i + 1}: invalid quantity min` }, { status: 400 });
    }
    if (quantityMax !== null && Number.isNaN(quantityMax)) {
      return NextResponse.json({ error: `Rule ${i + 1}: invalid quantity max` }, { status: 400 });
    }
    if (quantityMin != null && quantityMin < 1) {
      return NextResponse.json({ error: `Rule ${i + 1}: quantity min must be ≥ 1` }, { status: 400 });
    }
    if (quantityMax != null && quantityMax < 1) {
      return NextResponse.json({ error: `Rule ${i + 1}: quantity max must be ≥ 1` }, { status: 400 });
    }
    if (quantityMin != null && quantityMax != null && quantityMin > quantityMax) {
      return NextResponse.json(
        { error: `Rule ${i + 1}: quantity min cannot exceed max` },
        { status: 400 },
      );
    }

    const paperBasis = optPaperBasis(r.paperBasis);
    if (r.paperBasis != null && String(r.paperBasis).trim() !== "" && paperBasis == null) {
      return NextResponse.json(
        { error: `Rule ${i + 1}: basis type must be blank (any), TEXT, or COVER` },
        { status: 400 },
      );
    }

    normalized.push({
      sortOrder,
      name: optName(r.name),
      paperBasis,
      quantityMin: quantityMin !== null && !Number.isNaN(quantityMin) ? quantityMin : null,
      quantityMax: quantityMax !== null && !Number.isNaN(quantityMax) ? quantityMax : null,
      spoilagePercent,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.machineSpoilageRule.deleteMany({ where: { machineId } });
    if (normalized.length > 0) {
      await tx.machineSpoilageRule.createMany({
        data: normalized.map((row) => ({
          machineId,
          ...row,
        })),
      });
    }
  });

  const rules = await prisma.machineSpoilageRule.findMany({
    where: { machineId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(rules);
}
