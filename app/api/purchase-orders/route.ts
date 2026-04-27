import { NextResponse } from "next/server";
import { isActiveFilmMaterialCode, normalizeFilmMaterialCode } from "@/lib/film-material-service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { lines: true },
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reference = body.reference != null ? String(body.reference).trim() || null : null;
    const supplierName =
      body.supplierName != null ? String(body.supplierName).trim() || null : null;
    const vendorEmail =
      body.vendorEmail != null ? String(body.vendorEmail).trim() || null : null;
    const notes = body.notes != null ? String(body.notes).trim() || null : null;
    const linesIn = body.lines as unknown;

    if (!Array.isArray(linesIn) || linesIn.length === 0) {
      return NextResponse.json({ error: "At least one line is required" }, { status: 400 });
    }

    const linesData: {
      filmInventoryId: string | null;
      materialType: string;
      description: string;
      thicknessMil: number;
      rollWidth: number;
      orderedLinearFeet: number;
    }[] = [];

    for (const raw of linesIn) {
      const o = raw as Record<string, unknown>;
      const filmRaw = o.filmInventoryId;
      const filmInventoryId =
        filmRaw != null && String(filmRaw).trim() !== "" ? String(filmRaw).trim() : null;

      let mt = normalizeFilmMaterialCode(String(o.materialType ?? ""));
      let description = String(o.description ?? "").trim();
      let thicknessMil = Number(o.thicknessMil);
      let rollWidth = Number(o.rollWidth);
      const orderedLinearFeet = Number(o.orderedLinearFeet);

      if (filmInventoryId) {
        const roll = await prisma.filmInventory.findUnique({ where: { id: filmInventoryId } });
        if (!roll) {
          return NextResponse.json(
            { error: `filmInventoryId not found: ${filmInventoryId.slice(0, 8)}…` },
            { status: 400 },
          );
        }
        if (!mt) mt = roll.materialType;
        if (!description) description = roll.description;
        if (!Number.isFinite(thicknessMil)) thicknessMil = roll.thicknessMil;
        if (!Number.isFinite(rollWidth)) rollWidth = roll.rollWidth;
      }

      if (!(await isActiveFilmMaterialCode(mt))) {
        return NextResponse.json(
          { error: `Invalid or inactive material type: ${mt || "(empty)"}` },
          { status: 400 },
        );
      }
      if (!description) {
        return NextResponse.json({ error: "Each line needs a description" }, { status: 400 });
      }
      if (
        ![thicknessMil, rollWidth, orderedLinearFeet].every(
          (n) => Number.isFinite(n) && n > 0,
        )
      ) {
        return NextResponse.json(
          { error: "Thickness, roll width, and ordered linear feet must be positive" },
          { status: 400 },
        );
      }
      linesData.push({
        filmInventoryId,
        materialType: mt,
        description,
        thicknessMil,
        rollWidth,
        orderedLinearFeet,
      });
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        reference,
        supplierName,
        vendorEmail,
        notes,
        status: "DRAFT",
        lines: {
          create: linesData.map((l) => ({
            filmInventoryId: l.filmInventoryId,
            materialType: l.materialType,
            description: l.description,
            thicknessMil: l.thicknessMil,
            rollWidth: l.rollWidth,
            orderedLinearFeet: l.orderedLinearFeet,
          })),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json(po, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
