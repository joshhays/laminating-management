import { MachineTypeKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Laminating week grid: laminators (not cutters) plus job tickets that overlap the week.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("weekStart");
  const base = raw ? new Date(raw) : new Date();
  if (Number.isNaN(base.getTime())) {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }

  const weekStart = startOfWeekMonday(base);
  const weekEnd = addDays(weekStart, 7);

  const machines = await prisma.machine.findMany({
    where: {
      active: true,
      OR: [
        { machineTypeId: null },
        { machineType: { is: { kind: MachineTypeKind.LAMINATOR } } },
      ],
    },
    include: { machineType: true },
    orderBy: [{ name: "asc" }],
  });

  const [scheduled, unscheduled] = await Promise.all([
    prisma.jobTicket.findMany({
      where: {
        status: { in: ["QUEUED", "IN_PROGRESS"] },
        scheduledStart: { not: null },
        scheduledEnd: { not: null },
        AND: [{ scheduledStart: { lt: weekEnd } }, { scheduledEnd: { gt: weekStart } }],
      },
      include: {
        estimate: { include: { filmRoll: true, secondFilmRoll: true } },
        machine: true,
      },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.jobTicket.findMany({
      where: {
        status: { in: ["QUEUED", "IN_PROGRESS"] },
        OR: [{ scheduledStart: null }, { scheduledEnd: null }],
      },
      include: {
        estimate: { include: { filmRoll: true, secondFilmRoll: true } },
        machine: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    machines,
    scheduled,
    unscheduled,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  });
}
