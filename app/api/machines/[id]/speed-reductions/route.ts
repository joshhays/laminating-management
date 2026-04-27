import { NextResponse } from "next/server";
import { parseSpeedRulePaperColorInput } from "@/lib/estimate-paper-color";
import type { EstimatePaperColor } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

type RuleInput = {
  sortOrder?: number;
  name?: string | null;
  paperGsmMin?: number | string | null;
  paperGsmMax?: number | string | null;
  stockType?: string | null;
  printType?: string | null;
  paperColor?: string | null;
  filmMaterialType?: string | null;
  quantityMin?: number | string | null;
  quantityMax?: number | string | null;
  sheetWidthMinInches?: number | string | null;
  sheetWidthMaxInches?: number | string | null;
  sheetLengthMinInches?: number | string | null;
  sheetLengthMaxInches?: number | string | null;
  slowdownPercent: number | string;
};

function optFloat(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

function optInt(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isInteger(n) ? n : Number.NaN;
}

function optStrWild(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === "*") return null;
  return s;
}

function optName(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

export async function GET(_request: Request, { params }: Params) {
  const { id: machineId } = await params;
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }
  const rules = await prisma.machineSpeedReductionRule.findMany({
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
    paperGsmMin: number | null;
    paperGsmMax: number | null;
    stockType: string | null;
    printType: string | null;
    paperColor: EstimatePaperColor | null;
    filmMaterialType: string | null;
    quantityMin: number | null;
    quantityMax: number | null;
    sheetWidthMinInches: number | null;
    sheetWidthMaxInches: number | null;
    sheetLengthMinInches: number | null;
    sheetLengthMaxInches: number | null;
    slowdownPercent: number;
  }[] = [];

  for (let i = 0; i < body.rules.length; i++) {
    const r = body.rules[i];
    const sortOrder = r.sortOrder !== undefined ? Number(r.sortOrder) : i;
    const slowdownPercent = Number(r.slowdownPercent);

    const paperGsmMin = optFloat(r.paperGsmMin);
    const paperGsmMax = optFloat(r.paperGsmMax);
    const quantityMin = optInt(r.quantityMin);
    const quantityMax = optInt(r.quantityMax);
    const sheetWidthMinInches = optFloat(r.sheetWidthMinInches);
    const sheetWidthMaxInches = optFloat(r.sheetWidthMaxInches);
    const sheetLengthMinInches = optFloat(r.sheetLengthMinInches);
    const sheetLengthMaxInches = optFloat(r.sheetLengthMaxInches);

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: `Rule ${i + 1}: invalid sort order` }, { status: 400 });
    }
    if (!Number.isFinite(slowdownPercent) || slowdownPercent < 0 || slowdownPercent > 100) {
      return NextResponse.json(
        { error: `Rule ${i + 1}: slowdown % must be between 0 and 100` },
        { status: 400 },
      );
    }

    if (paperGsmMin !== null && Number.isNaN(paperGsmMin)) {
      return NextResponse.json({ error: `Rule ${i + 1}: invalid GSM min` }, { status: 400 });
    }
    if (paperGsmMax !== null && Number.isNaN(paperGsmMax)) {
      return NextResponse.json({ error: `Rule ${i + 1}: invalid GSM max` }, { status: 400 });
    }
    if (
      paperGsmMin != null &&
      paperGsmMax != null &&
      paperGsmMin > paperGsmMax + 1e-9
    ) {
      return NextResponse.json(
        { error: `Rule ${i + 1}: GSM min cannot exceed GSM max` },
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
    if (
      quantityMin != null &&
      quantityMax != null &&
      quantityMin > quantityMax
    ) {
      return NextResponse.json(
        { error: `Rule ${i + 1}: quantity min cannot exceed max` },
        { status: 400 },
      );
    }

    for (const [label, a, b] of [
      ["sheet width", sheetWidthMinInches, sheetWidthMaxInches],
      ["sheet length", sheetLengthMinInches, sheetLengthMaxInches],
    ] as const) {
      if (a !== null && Number.isNaN(a)) {
        return NextResponse.json({ error: `Rule ${i + 1}: invalid ${label} min` }, { status: 400 });
      }
      if (b !== null && Number.isNaN(b)) {
        return NextResponse.json({ error: `Rule ${i + 1}: invalid ${label} max` }, { status: 400 });
      }
      if (a != null && b != null && a > b + 1e-9) {
        return NextResponse.json(
          { error: `Rule ${i + 1}: ${label} min cannot exceed max` },
          { status: 400 },
        );
      }
    }

    const rulePaperColor = parseSpeedRulePaperColorInput(r.paperColor);
    if (rulePaperColor === "invalid") {
      return NextResponse.json(
        { error: `Rule ${i + 1}: paper color must be any, White, or Colored` },
        { status: 400 },
      );
    }

    normalized.push({
      sortOrder,
      name: optName(r.name),
      paperGsmMin: paperGsmMin !== null && !Number.isNaN(paperGsmMin) ? paperGsmMin : null,
      paperGsmMax: paperGsmMax !== null && !Number.isNaN(paperGsmMax) ? paperGsmMax : null,
      stockType: optStrWild(r.stockType),
      printType: optStrWild(r.printType),
      paperColor: rulePaperColor,
      filmMaterialType: optStrWild(r.filmMaterialType)?.toUpperCase() ?? null,
      quantityMin: quantityMin !== null && !Number.isNaN(quantityMin) ? quantityMin : null,
      quantityMax: quantityMax !== null && !Number.isNaN(quantityMax) ? quantityMax : null,
      sheetWidthMinInches:
        sheetWidthMinInches !== null && !Number.isNaN(sheetWidthMinInches)
          ? sheetWidthMinInches
          : null,
      sheetWidthMaxInches:
        sheetWidthMaxInches !== null && !Number.isNaN(sheetWidthMaxInches)
          ? sheetWidthMaxInches
          : null,
      sheetLengthMinInches:
        sheetLengthMinInches !== null && !Number.isNaN(sheetLengthMinInches)
          ? sheetLengthMinInches
          : null,
      sheetLengthMaxInches:
        sheetLengthMaxInches !== null && !Number.isNaN(sheetLengthMaxInches)
          ? sheetLengthMaxInches
          : null,
      slowdownPercent,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.machineSpeedReductionRule.deleteMany({ where: { machineId } });
    if (normalized.length > 0) {
      await tx.machineSpeedReductionRule.createMany({
        data: normalized.map((row) => ({
          machineId,
          ...row,
        })),
      });
    }
  });

  const rules = await prisma.machineSpeedReductionRule.findMany({
    where: { machineId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(rules);
}
