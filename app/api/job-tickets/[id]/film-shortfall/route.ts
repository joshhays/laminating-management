import { NextResponse } from "next/server";
import { getFilmShortfallForJob } from "@/lib/film-inventory-rollup";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const data = await getFilmShortfallForJob(prisma, id);
  if (!data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
