import { NextResponse } from "next/server";
import { pullFilmForAllocation } from "@/lib/inventory-pull-batch";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id: jobTicketId } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const allocs = await tx.jobFilmAllocation.findMany({
        where: { jobTicketId },
        include: { filmInventory: true },
        orderBy: { passOrder: "asc" },
      });

      if (allocs.length === 0) {
        throw new Error("NO_ALLOCATION");
      }

      const pending = allocs.filter((a) => a.status === "ALLOCATED");
      if (pending.length === 0) {
        throw new Error("ALREADY_HANDLED");
      }

      for (const alloc of pending) {
        await pullFilmForAllocation(tx, {
          allocationId: alloc.id,
          pullLinearFeet: alloc.allocatedLinearFeet,
          movementNote: `Pulled for job ${jobTicketId.slice(0, 8)}… (${alloc.allocatedLinearFeet} lin. ft)`,
        });
      }

      return { pulledCount: pending.length };
    });

    return NextResponse.json(result);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NO_ALLOCATION") {
      return NextResponse.json({ error: "No film allocation for this job" }, { status: 404 });
    }
    if (code === "ALREADY_HANDLED") {
      return NextResponse.json({ error: "Film already pulled or allocation cancelled" }, { status: 400 });
    }
    if (code === "INSUFFICIENT_STOCK" || code === "INVALID_PULL_FEET") {
      return NextResponse.json(
        { error: "Not enough linear feet on one of the allocated rolls" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Could not pull film" }, { status: 400 });
  }
}
