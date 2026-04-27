import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { parseCompanyType } from "@/lib/company-type-parse";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const take = Math.min(Number(searchParams.get("take")) || 30, 100);

  const where: Prisma.CompanyWhereInput =
    q.length > 0
      ? {
          OR: [
            { name: { contains: q } },
            { contacts: { some: { email: { contains: q } } } },
          ],
        }
      : {};

  const list = await prisma.company.findMany({
    where,
    take,
    orderBy: { name: "asc" },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
    },
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const row = await prisma.company.create({
      data: {
        name,
        type: parseCompanyType(body.type),
        website: body.website != null ? String(body.website).trim() || null : null,
        address: body.address != null ? String(body.address).trim() || null : null,
        notes: body.notes != null ? String(body.notes).trim() || null : null,
        creditLimit:
          body.creditLimit != null && String(body.creditLimit).trim() !== ""
            ? Number(body.creditLimit)
            : null,
        outstandingBalance:
          body.outstandingBalance != null && String(body.outstandingBalance).trim() !== ""
            ? Number(body.outstandingBalance)
            : 0,
      },
      include: { contacts: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A company with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
