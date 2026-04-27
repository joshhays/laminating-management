import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordActivity(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    type: ActivityType;
    title: string;
    body?: string | null;
    metadata?: Prisma.InputJsonValue;
    companyId?: string | null;
    contactId?: string | null;
    estimateId?: string | null;
    jobTicketId?: string | null;
    machineId?: string | null;
  },
) {
  await db.activity.create({
    data: {
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      metadata: params.metadata === undefined ? undefined : params.metadata,
      companyId: params.companyId ?? null,
      contactId: params.contactId ?? null,
      estimateId: params.estimateId ?? null,
      jobTicketId: params.jobTicketId ?? null,
      machineId: params.machineId ?? null,
    },
  });
}
