import { JobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.jobTicket.findMany({
    where: { status: { in: [JobStatus.QUEUED, JobStatus.IN_PROGRESS] } },
    orderBy: [{ scheduledStart: "asc" }, { jobNumber: "asc" }],
    take: 75,
    select: {
      id: true,
      jobNumber: true,
      status: true,
      machineAssigned: true,
      scheduledStart: true,
      estimate: {
        select: { filmType: true, sheetSize: true, estimateNumber: true },
      },
    },
  });
  return NextResponse.json(jobs);
}
