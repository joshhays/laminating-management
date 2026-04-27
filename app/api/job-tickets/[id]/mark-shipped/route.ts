import { ActivityType } from "@prisma/client";
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/crm-activity";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  const existing = await prisma.jobTicket.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (existing.status === "SHIPPED" && existing.shippedAt) {
    return NextResponse.json(existing);
  }

  const now = new Date();
  const updated = await prisma.jobTicket.update({
    where: { id },
    data: {
      status: "SHIPPED",
      shippedAt: now,
    },
    include: { estimate: true },
  });

  await recordActivity(prisma, {
    type: ActivityType.JOB_SHIPPED,
    title: "Job marked shipped",
    companyId: updated.estimate?.companyId ?? null,
    contactId: updated.estimate?.contactId ?? null,
    estimateId: updated.estimateId,
    jobTicketId: updated.id,
    machineId: updated.machineId,
  });

  return NextResponse.json(updated);
}
