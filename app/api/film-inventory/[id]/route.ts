import { NextResponse } from "next/server";
import { filmMaterialTypeLabel } from "@/lib/film-material-type";
import {
  ensureFilmMaterialTypeDefaults,
  getFilmMaterialLabelMap,
  isKnownFilmMaterialCode,
  normalizeFilmMaterialCode,
} from "@/lib/film-material-service";
import { normalizeVendorInput, parseOptionalFilmStockKind } from "@/lib/film-stock-kind";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await ensureFilmMaterialTypeDefaults();
    const row = await prisma.filmInventory.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const map = await getFilmMaterialLabelMap();
    return NextResponse.json({
      ...row,
      materialTypeLabel: filmMaterialTypeLabel(row.materialType, map),
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json();
    const rollWidth = body.rollWidth !== undefined ? Number(body.rollWidth) : undefined;
    const thicknessMil =
      body.thicknessMil !== undefined ? Number(body.thicknessMil) : undefined;
    const materialTypeRaw =
      body.materialType !== undefined
        ? normalizeFilmMaterialCode(String(body.materialType))
        : undefined;
    const description =
      body.description !== undefined ? String(body.description).trim() : undefined;
    const remainingLinearFeet =
      body.remainingLinearFeet !== undefined
        ? Number(body.remainingLinearFeet)
        : undefined;
    const pricePerFilmSquareInch =
      body.pricePerFilmSquareInch !== undefined
        ? Number(body.pricePerFilmSquareInch)
        : body.pricePerMaterialSquareInch !== undefined
          ? Number(body.pricePerMaterialSquareInch)
          : undefined;
    const stockKindRaw = body.stockKind;
    const stockKind =
      stockKindRaw !== undefined ? parseOptionalFilmStockKind(stockKindRaw) : undefined;
    const vendorRaw = body.vendor;

    if (stockKindRaw !== undefined && stockKindRaw !== null) {
      if (stockKind === undefined && String(stockKindRaw).trim() !== "") {
        return NextResponse.json(
          { error: "stockKind must be FLOOR_STOCK or CATALOG" },
          { status: 400 },
        );
      }
    }
    if (materialTypeRaw !== undefined && !(await isKnownFilmMaterialCode(materialTypeRaw))) {
      return NextResponse.json(
        { error: "Unknown material type code — define it under Material types first" },
        { status: 400 },
      );
    }
    if (description !== undefined && !description) {
      return NextResponse.json(
        { error: "Description cannot be empty" },
        { status: 400 },
      );
    }
    for (const [key, val] of [
      ["rollWidth", rollWidth],
      ["thicknessMil", thicknessMil],
      ["remainingLinearFeet", remainingLinearFeet],
    ] as const) {
      if (val !== undefined && (!Number.isFinite(val) || val < 0)) {
        return NextResponse.json(
          { error: `${key} must be a non-negative number` },
          { status: 400 },
        );
      }
    }
    if (
      pricePerFilmSquareInch !== undefined &&
      (!Number.isFinite(pricePerFilmSquareInch) || pricePerFilmSquareInch < 0)
    ) {
      return NextResponse.json(
        { error: "pricePerFilmSquareInch must be zero or positive" },
        { status: 400 },
      );
    }

    const updated = await prisma.filmInventory.update({
      where: { id },
      data: {
        ...(rollWidth !== undefined ? { rollWidth } : {}),
        ...(thicknessMil !== undefined ? { thicknessMil } : {}),
        ...(materialTypeRaw !== undefined ? { materialType: materialTypeRaw } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(stockKind !== undefined ? { stockKind } : {}),
        ...(vendorRaw !== undefined ? { vendor: normalizeVendorInput(vendorRaw) } : {}),
        ...(remainingLinearFeet !== undefined ? { remainingLinearFeet } : {}),
        ...(pricePerFilmSquareInch !== undefined ? { pricePerFilmSquareInch } : {}),
      },
    });
    const map = await getFilmMaterialLabelMap();
    return NextResponse.json({
      ...updated,
      materialTypeLabel: filmMaterialTypeLabel(updated.materialType, map),
    });
  } catch {
    return NextResponse.json({ error: "Not found or invalid body" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.filmInventory.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
