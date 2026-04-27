import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  collectUsedFilmMaterialCodes,
  ensureFilmMaterialTypeDefaults,
  normalizeFilmMaterialCode,
} from "@/lib/film-material-service";

export async function GET() {
  await ensureFilmMaterialTypeDefaults();
  const options = await prisma.filmMaterialTypeOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(options);
}

type RowIn = {
  code: string;
  label: string;
  sortOrder?: number;
  active?: boolean;
};

export async function PUT(request: Request) {
  await ensureFilmMaterialTypeDefaults();
  let body: { options: RowIn[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.options)) {
    return NextResponse.json({ error: "options array required" }, { status: 400 });
  }

  const normalized: { code: string; label: string; sortOrder: number; active: boolean }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < body.options.length; i++) {
    const r = body.options[i];
    const code = normalizeFilmMaterialCode(String(r.code ?? ""));
    const label = String(r.label ?? "").trim();
    const sortOrder = r.sortOrder !== undefined ? Number(r.sortOrder) : i;
    const active = r.active !== false;

    if (!code || code.length > 40) {
      return NextResponse.json(
        { error: `Row ${i + 1}: code must be 1–40 characters (letters, digits, underscore)` },
        { status: 400 },
      );
    }
    if (!/^[A-Z0-9_]+$/.test(code)) {
      return NextResponse.json(
        { error: `Row ${i + 1}: code must contain only A–Z, 0–9, and underscore` },
        { status: 400 },
      );
    }
    if (!label) {
      return NextResponse.json({ error: `Row ${i + 1}: label is required` }, { status: 400 });
    }
    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: `Row ${i + 1}: invalid sort order` }, { status: 400 });
    }
    if (seen.has(code)) {
      return NextResponse.json({ error: `Duplicate code: ${code}` }, { status: 400 });
    }
    seen.add(code);
    normalized.push({ code, label, sortOrder, active });
  }

  const activeCount = normalized.filter((o) => o.active).length;
  if (activeCount === 0) {
    return NextResponse.json(
      { error: "At least one active material type is required" },
      { status: 400 },
    );
  }

  const used = await collectUsedFilmMaterialCodes();
  const incoming = new Set(normalized.map((n) => n.code));
  for (const c of used) {
    if (!incoming.has(c)) {
      return NextResponse.json(
        {
          error: `Cannot remove code "${c}": it is still used on a film roll or purchase order line`,
        },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.filmMaterialTypeOption.deleteMany({});
    if (normalized.length > 0) {
      await tx.filmMaterialTypeOption.createMany({
        data: normalized.map((n) => ({
          code: n.code,
          label: n.label,
          sortOrder: n.sortOrder,
          active: n.active,
        })),
      });
    }
  });

  const options = await prisma.filmMaterialTypeOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(options);
}
