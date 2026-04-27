import { NextResponse } from "next/server";
import { assertAdminPin } from "@/lib/admin-pin";
import {
  PULL_EPS,
  pullFilmForAllocation,
  pullHasVarianceVsEstimate,
} from "@/lib/inventory-pull-batch";
import { prisma } from "@/lib/prisma";

type Body = {
  pin?: string;
  items?: Array<{ allocationId: string; pullLinearFeet: number }>;
  approvedVarianceAllocationIds?: string[];
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    assertAdminPin(body.pin);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = body.items ?? [];
  if (items.length === 0) {
    return NextResponse.json({ error: "No allocations to pull" }, { status: 400 });
  }

  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.allocationId)) {
      return NextResponse.json(
        { error: "Duplicate allocationId in request" },
        { status: 400 },
      );
    }
    seen.add(it.allocationId);
    if (!Number.isFinite(it.pullLinearFeet) || it.pullLinearFeet <= PULL_EPS) {
      return NextResponse.json(
        { error: "Each item needs pullLinearFeet greater than zero" },
        { status: 400 },
      );
    }
  }

  const approved = new Set(body.approvedVarianceAllocationIds ?? []);

  const allocs = await prisma.jobFilmAllocation.findMany({
    where: { id: { in: items.map((i) => i.allocationId) } },
    include: { filmInventory: true },
  });
  const byId = new Map(allocs.map((a) => [a.id, a]));

  const needingApproval: string[] = [];
  for (const it of items) {
    const alloc = byId.get(it.allocationId);
    if (!alloc) {
      return NextResponse.json(
        { error: `Unknown allocation ${it.allocationId}` },
        { status: 400 },
      );
    }
    if (alloc.status !== "ALLOCATED") {
      return NextResponse.json(
        { error: `Allocation ${it.allocationId.slice(0, 8)}… is not pending (already pulled or cancelled)` },
        { status: 400 },
      );
    }
    if (pullHasVarianceVsEstimate(it.pullLinearFeet, alloc) && !approved.has(it.allocationId)) {
      needingApproval.push(it.allocationId);
    }
  }

  if (needingApproval.length > 0) {
    return NextResponse.json(
      {
        error:
          "Pull amount differs from the estimate snapshot for one or more lines. Approve those rows and try again.",
        allocationIdsNeedingApproval: needingApproval,
      },
      { status: 400 },
    );
  }

  try {
    const jobIds = new Set<string>();
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const r = await pullFilmForAllocation(tx, {
          allocationId: it.allocationId,
          pullLinearFeet: it.pullLinearFeet,
        });
        jobIds.add(r.jobTicketId);
      }
    });
    return NextResponse.json({ ok: true, pulledCount: items.length, jobTicketIds: [...jobIds] });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "INVALID_PULL_FEET") {
      return NextResponse.json({ error: "Invalid pull amount" }, { status: 400 });
    }
    if (code === "ALLOCATION_NOT_FOUND") {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    if (code === "ALLOCATION_NOT_PENDING") {
      return NextResponse.json({ error: "Allocation is not pending" }, { status: 400 });
    }
    if (code === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Not enough linear feet on one of the allocated rolls" },
        { status: 400 },
      );
    }
    throw e;
  }
}
