import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: companyId } = await params;
  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const emailRaw = String(body.email ?? "").trim().toLowerCase();
    const email = emailRaw.length > 0 ? emailRaw : null;
    const phone = body.phone != null ? String(body.phone).trim() || null : null;
    const isPrimary = body.isPrimary === true;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }

    const contact = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.contact.updateMany({
          where: { companyId },
          data: { isPrimary: false },
        });
      }
      return tx.contact.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          isPrimary,
          companyId,
        },
      });
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "This email is already used by another contact" }, { status: 409 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
