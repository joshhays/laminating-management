import { NextResponse } from "next/server";
import { filmMaterialTypeLabel } from "@/lib/film-material-type";
import {
  ensureFilmMaterialTypeDefaults,
  getFilmMaterialLabelMap,
  isActiveFilmMaterialCode,
  normalizeFilmMaterialCode,
} from "@/lib/film-material-service";
import {
  defaultFilmStockKind,
  normalizeVendorInput,
  parseOptionalFilmStockKind,
} from "@/lib/film-stock-kind";
import { filmRollupMapForIds } from "@/lib/film-inventory-rollup";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await ensureFilmMaterialTypeDefaults();
  const items = await prisma.filmInventory.findMany({
    orderBy: { createdAt: "desc" },
  });
  const map = await getFilmMaterialLabelMap();
  const rollup = await filmRollupMapForIds(
    prisma,
    items.map((row) => ({ id: row.id, remainingLinearFeet: row.remainingLinearFeet })),
  );
  return NextResponse.json(
    items.map((row) => ({
      ...row,
      materialTypeLabel: filmMaterialTypeLabel(row.materialType, map),
      ...(rollup.get(row.id) ?? {
        inEstimateCount: 0,
        allocatedToJobLinearFeet: 0,
        onOrderOpenLinearFeet: 0,
        onHandLinearFeet: row.remainingLinearFeet,
        availableLinearFeet: Math.max(0, row.remainingLinearFeet),
      }),
    })),
  );
}

export async function POST(request: Request) {
  try {
    await ensureFilmMaterialTypeDefaults();
    const body = await request.json();
    const rollWidth = Number(body.rollWidth);
    const thicknessMil = Number(body.thicknessMil);
    const materialTypeRaw = normalizeFilmMaterialCode(String(body.materialType ?? ""));
    const description = String(body.description ?? "").trim();
    const remainingLinearFeet = Number(body.remainingLinearFeet);
    const pricePerFilmSquareInch = Number(
      body.pricePerFilmSquareInch ?? body.pricePerMaterialSquareInch ?? 0,
    );
    let stockKind = defaultFilmStockKind();
    if (body.stockKind !== undefined && body.stockKind !== null) {
      const sk = parseOptionalFilmStockKind(body.stockKind);
      if (sk === undefined && String(body.stockKind).trim() !== "") {
        return NextResponse.json(
          { error: "stockKind must be FLOOR_STOCK or CATALOG" },
          { status: 400 },
        );
      }
      if (sk) stockKind = sk;
    }
    const vendor = normalizeVendorInput(body.vendor);

    if (!(await isActiveFilmMaterialCode(materialTypeRaw))) {
      return NextResponse.json(
        { error: "Invalid or inactive material type — add or enable it under Film inventory → Material types" },
        { status: 400 },
      );
    }
    if (!description) {
      return NextResponse.json(
        { error: "Description is required (e.g. Matte, Gloss UV)" },
        { status: 400 },
      );
    }
    if (![rollWidth, thicknessMil, remainingLinearFeet].every((n) => Number.isFinite(n) && n >= 0)) {
      return NextResponse.json(
        {
          error:
            "rollWidth, thicknessMil, and remainingLinearFeet must be non-negative numbers",
        },
        { status: 400 },
      );
    }
    if (!Number.isFinite(pricePerFilmSquareInch) || pricePerFilmSquareInch < 0) {
      return NextResponse.json(
        { error: "pricePerFilmSquareInch must be zero or positive" },
        { status: 400 },
      );
    }

    const created = await prisma.filmInventory.create({
      data: {
        rollWidth,
        thicknessMil,
        materialType: materialTypeRaw,
        description,
        stockKind,
        vendor,
        remainingLinearFeet,
        pricePerFilmSquareInch,
      },
    });
    const map = await getFilmMaterialLabelMap();
    return NextResponse.json(
      {
        ...created,
        materialTypeLabel: filmMaterialTypeLabel(created.materialType, map),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
