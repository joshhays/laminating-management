import { JobStatus, JobWorkflowStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  ensurePurchaseRequirementsForLowStock,
  isWorkflowLocked,
  nextWorkflowStatus,
} from "@/lib/workflow/job-workflow";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const job = await tx.jobTicket.findUnique({ where: { id } });
      if (!job) {
        throw new Error("NOT_FOUND");
      }
      if (isWorkflowLocked(job)) {
        throw new Error("LOCKED");
      }

      const next = nextWorkflowStatus(job.workflowStatus);
      if (!next) {
        throw new Error("NO_NEXT");
      }

      if (
        (job.workflowStatus === JobWorkflowStatus.QUOTED && next === JobWorkflowStatus.AWARDED) ||
        (job.workflowStatus === JobWorkflowStatus.AWARDED && next === JobWorkflowStatus.PURCHASING)
      ) {
        await ensurePurchaseRequirementsForLowStock(tx, id);
      }

      const data: {
        workflowStatus: JobWorkflowStatus;
        workflowLockedAt?: Date | null;
        status?: JobStatus;
        shippedAt?: Date | null;
      } = { workflowStatus: next };

      if (next === JobWorkflowStatus.PRODUCTION && job.status === JobStatus.QUEUED) {
        data.status = JobStatus.IN_PROGRESS;
      }
      if (next === JobWorkflowStatus.SHIPPING) {
        if (job.status !== JobStatus.SHIPPED) {
          data.status = JobStatus.DONE;
        }
      }
      if (next === JobWorkflowStatus.COMPLETE) {
        data.workflowLockedAt = new Date();
        data.status = JobStatus.SHIPPED;
        data.shippedAt = job.shippedAt ?? new Date();
      }

      return tx.jobTicket.update({
        where: { id },
        data,
        select: {
          id: true,
          workflowStatus: true,
          workflowLockedAt: true,
          status: true,
        },
      });
    });

    return NextResponse.json(updated);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (code === "LOCKED") {
      return NextResponse.json({ error: "Job is complete and locked" }, { status: 403 });
    }
    if (code === "NO_NEXT") {
      return NextResponse.json({ error: "Already at final stage" }, { status: 400 });
    }
    throw e;
  }
}
