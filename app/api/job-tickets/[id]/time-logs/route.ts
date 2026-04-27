import { JobTimeActivityKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { getShopFloorSessionEmployee } from "@/lib/shop-floor/session";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: jobTicketId } = await params;
  const job = await prisma.jobTicket.findUnique({ where: { id: jobTicketId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const logs = await prisma.jobTimeLog.findMany({
    where: { jobTicketId },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json(logs);
}

export async function POST(request: Request, { params }: Params) {
  const { id: jobTicketId } = await params;
  const emp = await getShopFloorSessionEmployee();
  if (!emp) {
    return NextResponse.json({ error: "Sign in on Shop floor first" }, { status: 401 });
  }

  let body: { activityKind?: string; notes?: string | null };
  try {
    body = (await request.json()) as { activityKind?: string; notes?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawKind = String(body.activityKind ?? JobTimeActivityKind.LINE_TIME).toUpperCase();
  if (rawKind !== JobTimeActivityKind.LINE_TIME) {
    return NextResponse.json(
      { error: "Only run timers are supported (line / machine time)" },
      { status: 400 },
    );
  }
  const activityKind = JobTimeActivityKind.LINE_TIME;
  const notes =
    body.notes == null || body.notes === ""
      ? null
      : String(body.notes).trim().slice(0, 2000) || null;

  const job = await prisma.jobTicket.findUnique({ where: { id: jobTicketId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const log = await prisma.$transaction(async (tx) => {
      const open = await tx.jobTimeLog.findFirst({
        where: { employeeId: emp.id, endedAt: null },
      });
      if (open) {
        return null;
      }

      const created = await tx.jobTimeLog.create({
        data: {
          jobTicketId,
          employeeId: emp.id,
          activityKind,
          startedAt: new Date(),
          notes,
        },
        include: { employee: { select: { id: true, name: true } } },
      });
      return created;
    });
    if (log == null) {
      return NextResponse.json(
        { error: "Stop your current run (enter sheets ran) before starting another timer" },
        { status: 409 },
      );
    }
    return NextResponse.json(log, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not start timer" }, { status: 400 });
  }
}
