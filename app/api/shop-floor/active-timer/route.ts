import { NextResponse } from "next/server";
import { getShopFloorSessionEmployee } from "@/lib/shop-floor/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const emp = await getShopFloorSessionEmployee();
  if (!emp) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const log = await prisma.jobTimeLog.findFirst({
    where: { employeeId: emp.id, endedAt: null },
    include: {
      jobTicket: {
        select: {
          id: true,
          jobNumber: true,
          status: true,
          machineAssigned: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });
  if (!log) return NextResponse.json({ active: null });
  return NextResponse.json({
    active: {
      id: log.id,
      jobTicketId: log.jobTicketId,
      activityKind: log.activityKind,
      startedAt: log.startedAt.toISOString(),
      notes: log.notes,
      job: log.jobTicket,
    },
  });
}
