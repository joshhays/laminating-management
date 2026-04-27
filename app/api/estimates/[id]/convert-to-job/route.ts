import { ActivityType, JobWorkflowStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/crm-activity";
import { buildLaminationJobTicketSnapshot } from "@/lib/lamination-job-ticket-snapshot";
import { nextJobNumberForCreate } from "@/lib/job-number";
import {
  laminatingRunMinutesFromEstimate,
  nextQuarterHourAfter,
} from "@/lib/laminating-schedule/schedule-times";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id: estimateId } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      jobTicket: true,
      machine: true,
      lines: { orderBy: { sortOrder: "asc" } },
      cutterMachine: true,
      filmRoll: true,
      secondFilmRoll: true,
    },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  if (estimate.jobTicket) {
    return NextResponse.json(
      {
        error: "This estimate already has a job ticket",
        jobId: estimate.jobTicket.id,
      },
      { status: 409 },
    );
  }

  if (!estimate.filmInventoryId) {
    return NextResponse.json({ error: "Estimate has no primary film roll" }, { status: 400 });
  }

  const lfPerPass = estimate.estimatedLinearFeet;
  const passCount = estimate.passCount >= 2 ? 2 : 1;
  const secondPass = estimate.secondPassEnabled && passCount === 2;
  const sameFilm =
    !secondPass || estimate.secondFilmSameAsFirst || !estimate.secondFilmInventoryId;

  const runMin = laminatingRunMinutesFromEstimate(estimate.estimatedRunTimeMinutes);
  const scheduledStart = nextQuarterHourAfter(new Date());
  const scheduledEnd = new Date(scheduledStart.getTime() + runMin * 60_000);

  const scheduleFmt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
  const scheduleLine = `Initial schedule: ${scheduleFmt.format(scheduledStart)} — ${scheduleFmt.format(scheduledEnd)}`;

  const job = await prisma.$transaction(async (tx) => {
    const jobNumber = await nextJobNumberForCreate(tx);
    const snap = buildLaminationJobTicketSnapshot(estimate);
    const pressRunInformation = [snap.pressRunInformation, scheduleLine].join("\n");

    const j = await tx.jobTicket.create({
      data: {
        jobNumber,
        machineAssigned: estimate.machine?.name ?? "Unassigned",
        machineId: estimate.machineId,
        estimateId: estimate.id,
        status: "QUEUED",
        workflowStatus: JobWorkflowStatus.AWARDED,
        scheduledStart,
        scheduledEnd,
        ticketTitle: snap.ticketTitle,
        ticketDescriptionAdditional: snap.ticketDescriptionAdditional,
        customerCompanyName: snap.customerCompanyName,
        customerAddress: snap.customerAddress,
        customerContactName: snap.customerContactName,
        customerContactEmail: snap.customerContactEmail,
        stockInformation: snap.stockInformation,
        filmInformation: snap.filmInformation,
        pressRunInformation,
        binderyInstructions: snap.binderyInstructions,
        shippingInstructions: snap.shippingInstructions,
      },
    });

    const primaryFilmId = estimate.filmInventoryId!;

    if (secondPass && !sameFilm && estimate.secondFilmInventoryId) {
      await tx.jobFilmAllocation.create({
        data: {
          jobTicketId: j.id,
          filmInventoryId: primaryFilmId,
          allocatedLinearFeet: lfPerPass,
          estimatedLinearFeetSnapshot: lfPerPass,
          passOrder: 1,
        },
      });
      await tx.jobFilmAllocation.create({
        data: {
          jobTicketId: j.id,
          filmInventoryId: estimate.secondFilmInventoryId,
          allocatedLinearFeet: lfPerPass,
          estimatedLinearFeetSnapshot: lfPerPass,
          passOrder: 2,
        },
      });
    } else {
      const totalLf = secondPass && sameFilm ? lfPerPass * 2 : lfPerPass;
      await tx.jobFilmAllocation.create({
        data: {
          jobTicketId: j.id,
          filmInventoryId: primaryFilmId,
          allocatedLinearFeet: totalLf,
          estimatedLinearFeetSnapshot: totalLf,
          passOrder: 1,
        },
      });
    }

    const estLabel =
      estimate.estimateNumber != null
        ? `Estimate #${estimate.estimateNumber}`
        : `Estimate ${estimate.id.slice(0, 8)}…`;
    await recordActivity(tx, {
      type: ActivityType.JOB_CREATED,
      title: `Job #${jobNumber} — ${estimate.machine?.name ?? j.machineAssigned}`,
      body: `${estLabel} · Job #${jobNumber}`,
      companyId: estimate.companyId,
      contactId: estimate.contactId,
      estimateId: estimate.id,
      jobTicketId: j.id,
      machineId: j.machineId,
    });

    return j;
  });

  return NextResponse.json({ jobId: job.id, jobNumber: job.jobNumber }, { status: 201 });
}
