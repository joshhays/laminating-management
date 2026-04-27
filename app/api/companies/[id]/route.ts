import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { parseCustomFieldsInput } from "@/lib/crm-custom-fields";
import { prisma } from "@/lib/prisma";

import { parseCompanyType } from "@/lib/company-type-parse";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    name?: string;
    type?: ReturnType<typeof parseCompanyType>;
    website?: string | null;
    address?: string | null;
    notes?: string | null;
    creditLimit?: number | null;
    outstandingBalance?: number;
    customFields?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  } = {};

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    data.name = name;
  }
  if ("type" in body) {
    data.type = parseCompanyType(body.type);
  }
  if ("website" in body) {
    data.website = body.website != null ? String(body.website).trim() || null : null;
  }
  if ("address" in body) {
    data.address = body.address != null ? String(body.address).trim() || null : null;
  }
  if ("notes" in body) {
    data.notes = body.notes != null ? String(body.notes).trim() || null : null;
  }
  if ("creditLimit" in body) {
    if (body.creditLimit === null || String(body.creditLimit).trim() === "") {
      data.creditLimit = null;
    } else {
      const n = Number(body.creditLimit);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "creditLimit must be a non-negative number" }, { status: 400 });
      }
      data.creditLimit = n;
    }
  }
  if ("outstandingBalance" in body) {
    const n = Number(body.outstandingBalance);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "outstandingBalance must be a non-negative number" }, { status: 400 });
    }
    data.outstandingBalance = n;
  }
  if ("customFields" in body) {
    if (body.customFields === null) {
      data.customFields = Prisma.DbNull;
    } else {
      try {
        const parsed = parseCustomFieldsInput(body.customFields);
        data.customFields = parsed === undefined ? {} : parsed;
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid customFields" },
          { status: 400 },
        );
      }
    }
  }

  if (Object.keys(data).length === 0) {
    const row = await prisma.company.findUnique({
      where: { id },
      include: { contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] } },
    });
    return NextResponse.json(row);
  }

  try {
    const row = await prisma.company.update({
      where: { id },
      data,
      include: { contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] } },
    });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A company with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
