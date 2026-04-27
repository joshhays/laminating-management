import { NextResponse } from "next/server";
import { assertAdminPin } from "@/lib/admin-pin";
import { PULL_EPS } from "@/lib/inventory-pull-batch";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; allocationId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: jobTicketId, allocationId } = await params;
  let body: { pin?: string; allocatedLinearFeet?: unknown };
  try {
    body = (await request.json()) as { pin?: string; allocatedLinearFeet?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    assertAdminPin(body.pin);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feet = typeof body.allocatedLinearFeet === "number" ? body.allocatedLinearFeet : Number(body.allocatedLinearFeet);
  if (!Number.isFinite(feet) || feet <= PULL_EPS) {
    return NextResponse.json({ error: "allocatedLinearFeet must be a positive number" }, { status: 400 });
  }

  const alloc = await prisma.jobFilmAllocation.findFirst({
    where: { id: allocationId, jobTicketId },
  });
  if (!alloc) {
    return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
  }
  if (alloc.status !== "ALLOCATED") {
    return NextResponse.json(
      { error: "Only allocations that are still pending can be edited" },
      { status: 400 },
    );
  }

  await prisma.jobFilmAllocation.update({
    where: { id: allocationId },
    data: { allocatedLinearFeet: feet },
  });

  return NextResponse.json({ ok: true, allocatedLinearFeet: feet });
}
