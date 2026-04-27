import { NextResponse } from "next/server";
import { getFilmRollUsageDetail } from "@/lib/film-inventory-rollup";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const detail = await getFilmRollUsageDetail(prisma, id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
