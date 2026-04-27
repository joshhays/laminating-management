import { CompanyFileKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function parseKind(raw: unknown): CompanyFileKind {
  const t = String(raw ?? "OTHER").trim().toUpperCase();
  if (t === "LOGO") return CompanyFileKind.LOGO;
  if (t === "BRAND_GUIDELINES") return CompanyFileKind.BRAND_GUIDELINES;
  return CompanyFileKind.OTHER;
}

export async function POST(request: Request, { params }: Params) {
  const { id: companyId } = await params;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const url = String(body.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const row = await prisma.companyFile.create({
      data: {
        companyId,
        url,
        kind: parseKind(body.kind),
        label: body.label != null ? String(body.label).trim() || null : null,
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
