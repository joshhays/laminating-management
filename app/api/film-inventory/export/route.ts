import { NextResponse } from "next/server";
import { filmInventoryRowsToCsv } from "@/lib/film-inventory-csv";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.filmInventory.findMany({ orderBy: { createdAt: "asc" } });
  const csv = filmInventoryRowsToCsv(rows);
  const name = `film-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
