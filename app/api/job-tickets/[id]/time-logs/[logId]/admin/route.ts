import { JobTimeActivityKind } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertAdminPin } from "@/lib/admin-pin";
import { recalcJobTicketActualHours } from "@/lib/job-time-aggregates";
import { RUN_FILM_ERROR, applyRunFilmConsumption } from "@/lib/job-run-film-inventory";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; logId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id: jobTicketId, logId } = await params;
  let body: {
    pin?: string;
    startedAt?: string | null;
    endedAt?: string | null;
    notes?: string | null;
    sheetsRun?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    assertAdminPin(body.pin);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = await prisma.jobTimeLog.findFirst({
    where: { id: logId, jobTicketId },
  });
  if (!log) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  const movementCount = await prisma.inventoryMovement.count({
    where: { jobTimeLogId: logId },
  });

  const isOpen = log.endedAt == null;
  if (isOpen) {
    if (body.endedAt != null || body.sheetsRun != null) {
      return NextResponse.json(
        {
          error:
            "Open timers can only have start time and notes edited. Stop the run on the shop floor first to set sheets or end time.",
        },
        { status: 400 },
      );
    }
  }

  const nextStarted =
    body.startedAt !== undefined && body.startedAt !== null && body.startedAt !== ""
      ? new Date(body.startedAt)
      : log.startedAt;
  if (Number.isNaN(nextStarted.getTime())) {
    return NextResponse.json({ error: "Invalid startedAt" }, { status: 400 });
  }

  let nextEnded: Date | null;
  if (body.endedAt === undefined) {
    nextEnded = log.endedAt;
  } else if (body.endedAt === null || body.endedAt === "") {
    nextEnded = null;
  } else {
    const d = new Date(body.endedAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid endedAt" }, { status: 400 });
    }
    nextEnded = d;
  }

  if (nextEnded != null && nextEnded < nextStarted) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const data: Prisma.JobTimeLogUpdateInput = {};
  if (body.startedAt !== undefined && body.startedAt !== null && body.startedAt !== "") {
    data.startedAt = nextStarted;
  }
  if (body.endedAt !== undefined) {
    data.endedAt = nextEnded;
  }
  if (body.notes !== undefined) {
    data.notes =
      body.notes == null || body.notes === ""
        ? null
        : String(body.notes).trim().slice(0, 2000) || null;
  }

  let sheetsRun: number | undefined;
  if (body.sheetsRun !== undefined && log.activityKind === JobTimeActivityKind.LINE_TIME) {
    const n = typeof body.sheetsRun === "number" ? body.sheetsRun : Number(String(body.sheetsRun).trim());
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "sheetsRun must be a whole number ≥ 1" }, { status: 400 });
    }
    if (movementCount > 0 && n !== log.sheetsRun) {
      return NextResponse.json(
        { error: "Cannot change sheet count after film movements exist for this run" },
        { status: 400 },
      );
    }
    if (movementCount === 0) {
      sheetsRun = n;
      data.sheetsRun = n;
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.jobTimeLog.update({
        where: { id: logId },
        data,
        include: { employee: { select: { id: true, name: true } } },
      });
      if (
        log.activityKind === JobTimeActivityKind.LINE_TIME &&
        sheetsRun != null &&
        u.endedAt != null &&
        movementCount === 0
      ) {
        await applyRunFilmConsumption(tx, {
          jobTicketId,
          timeLogId: logId,
          sheetsRun,
        });
      }
      await recalcJobTicketActualHours(tx, jobTicketId);
      return u;
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === RUN_FILM_ERROR.INSUFFICIENT_FLOOR_STOCK) {
      return NextResponse.json(
        { error: "Not enough linear feet on the allocated floor roll for this run" },
        { status: 400 },
      );
    }
    if (msg === RUN_FILM_ERROR.OVER_JOB_FILM_BUDGET) {
      return NextResponse.json(
        {
          error:
            "Sheets ran would use more film than planned for this job. Reduce the sheet count or adjust the job film allocation.",
        },
        { status: 400 },
      );
    }
    throw e;
  }
}
