import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimatePlacementMinutes } from "@/lib/print-scheduler/estimate-run";
import { requirePermission, requireSession } from "@/lib/print-scheduler/api-auth";
import { jobAccessibleByUser, machineSlugAllowedForUser } from "@/lib/print-scheduler/machine-scope";

export const runtime = "nodejs";

const ACTIONS = new Set([
  "startRun",
  "finishRun",
  "cancelJob",
  "unscheduleJob",
  "pauseRun",
  "resumeRun",
]);

function normStatus(value: string | null | undefined): string {
  const s = (value ?? "").trim().toLowerCase();
  return s || "scheduled";
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canViewSchedule");
  if (allowed !== true) return allowed;

  const { id } = await ctx.params;
  try {
    const job = await prisma.printScheduleJob.findUnique({
      where: { id },
      include: { machine: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (!jobAccessibleByUser(sess, job.machineId)) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (e) {
    console.error("[GET /api/jobs/[id]]", e);
    return NextResponse.json({ error: "Could not load job." }, { status: 503 });
  }
}

function addPauseMs(
  totalPausedMs: number,
  pausedAt: Date | null,
  now: Date,
): number {
  if (!pausedAt) return totalPausedMs;
  return totalPausedMs + Math.max(0, now.getTime() - pausedAt.getTime());
}

/**
 * Body options:
 * - `action`: `startRun` | `finishRun` | `cancelJob` | `unscheduleJob` | `pauseRun` | `resumeRun`
 * - Or patch: `startTime`, `endTime`, `resourceId`, `title`, `color`, `calendarStatus`,
 *   `pressRunStartedAt`, `pressRunEndedAt`, `duplex`, `paperGsm`,
 *   `recalculateEndFromPressSpeed` (recompute `endTime` from press rules when moving presses)
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canEditSchedule");
  if (allowed !== true) return allowed;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existingRow = await prisma.printScheduleJob.findUnique({ where: { id } });
  if (!existingRow) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  if (!jobAccessibleByUser(sess, existingRow.machineId)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const action = typeof body.action === "string" ? body.action : undefined;

  if (action && ACTIONS.has(action)) {
    try {
      const existing = existingRow;

      const now = new Date();
      const data: Prisma.PrintScheduleJobUpdateInput = {};
      const st = normStatus(existing.calendarStatus);

      if (action === "startRun") {
        if (st === "running") {
          return NextResponse.json({ error: "Press run is already running." }, { status: 400 });
        }
        if (st === "paused") {
          return NextResponse.json(
            { error: "Job is paused — use Resume instead of Start." },
            { status: 400 },
          );
        }
        if (st === "completed" || st === "cancelled") {
          return NextResponse.json(
            { error: "Cannot start a completed or cancelled job." },
            { status: 400 },
          );
        }
        data.pressRunStartedAt = now;
        data.pressRunEndedAt = null;
        data.pressRunPausedAt = null;
        data.pressRunTotalPausedMs = 0;
        data.calendarStatus = "running";
      } else if (action === "pauseRun") {
        if (st !== "running" || !existing.pressRunStartedAt) {
          return NextResponse.json({ error: "Nothing is running to pause." }, { status: 400 });
        }
        if (existing.pressRunEndedAt) {
          return NextResponse.json({ error: "Press run already ended." }, { status: 400 });
        }
        if (existing.pressRunPausedAt) {
          return NextResponse.json({ error: "Already paused." }, { status: 400 });
        }
        data.calendarStatus = "paused";
        data.pressRunPausedAt = now;
      } else if (action === "resumeRun") {
        if (st !== "paused" || !existing.pressRunPausedAt) {
          return NextResponse.json({ error: "Job is not paused." }, { status: 400 });
        }
        if (!existing.pressRunStartedAt) {
          return NextResponse.json({ error: "Cannot resume without a start time." }, { status: 400 });
        }
        const added = now.getTime() - existing.pressRunPausedAt.getTime();
        data.pressRunTotalPausedMs = (existing.pressRunTotalPausedMs ?? 0) + Math.max(0, added);
        data.pressRunPausedAt = null;
        data.calendarStatus = "running";
      } else if (action === "finishRun") {
        const okState =
          (st === "running" || st === "paused") &&
          existing.pressRunStartedAt &&
          !existing.pressRunEndedAt;
        if (!okState) {
          return NextResponse.json(
            { error: "Finish only applies to an active or paused press run." },
            { status: 400 },
          );
        }
        const finalPausedTotal = addPauseMs(
          existing.pressRunTotalPausedMs ?? 0,
          existing.pressRunPausedAt,
          now,
        );
        data.pressRunEndedAt = now;
        data.pressRunPausedAt = null;
        data.pressRunTotalPausedMs = finalPausedTotal;
        data.calendarStatus = "completed";
        data.startTime = null;
        data.endTime = null;
      } else if (action === "unscheduleJob") {
        const activePress =
          existing.pressRunStartedAt != null && existing.pressRunEndedAt == null;
        if (activePress) {
          return NextResponse.json(
            {
              error:
                "This job is on press (running or paused). Finish or cancel the press run before removing it from the schedule.",
            },
            { status: 400 },
          );
        }
        if (st === "completed" || st === "cancelled") {
          return NextResponse.json(
            { error: "Completed and cancelled jobs are not on the schedule." },
            { status: 400 },
          );
        }
        data.startTime = null;
        data.endTime = null;
        data.calendarStatus = "scheduled";
        data.machine = { disconnect: true };
      } else if (action === "cancelJob") {
        data.calendarStatus = "cancelled";
        data.startTime = null;
        data.endTime = null;
        data.pressRunStartedAt = null;
        data.pressRunEndedAt = null;
        data.pressRunPausedAt = null;
        data.pressRunTotalPausedMs = 0;
        data.machine = { disconnect: true };
      } else {
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
      }

      const job = await prisma.printScheduleJob.update({
        where: { id },
        data,
        include: { machine: true },
      });
      return NextResponse.json(job);
    } catch (e) {
      console.error("[PATCH /api/jobs/[id] action]", e);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return NextResponse.json({ error: "Job not found." }, { status: 404 });
      }
      const hint =
        e instanceof Error
          ? e.message
          : "Check server logs. If you recently pulled code, run: npx prisma db push";
      return NextResponse.json(
        { error: "Could not update job.", hint },
        { status: 500 },
      );
    }
  }

  const data: Prisma.PrintScheduleJobUpdateInput = {};

  if ("pressRunStartedAt" in body) {
    const v = body.pressRunStartedAt;
    if (v === null) data.pressRunStartedAt = null;
    else if (typeof v === "string") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) data.pressRunStartedAt = d;
    }
  }
  if ("pressRunEndedAt" in body) {
    const v = body.pressRunEndedAt;
    if (v === null) data.pressRunEndedAt = null;
    else if (typeof v === "string") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) data.pressRunEndedAt = d;
    }
  }
  if ("pressRunPausedAt" in body) {
    const v = body.pressRunPausedAt;
    if (v === null) data.pressRunPausedAt = null;
    else if (typeof v === "string") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) data.pressRunPausedAt = d;
    }
  }
  if ("pressRunTotalPausedMs" in body) {
    const v = body.pressRunTotalPausedMs;
    if (v === null) data.pressRunTotalPausedMs = 0;
    else if (typeof v === "number" && Number.isFinite(v)) {
      data.pressRunTotalPausedMs = Math.max(0, Math.round(v));
    }
  }

  if ("startTime" in body) {
    const v = body.startTime;
    if (v === null) data.startTime = null;
    else if (typeof v === "string") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
      }
      data.startTime = d;
    } else {
      return NextResponse.json({ error: "startTime must be string or null" }, { status: 400 });
    }
  }

  if ("endTime" in body) {
    const v = body.endTime;
    if (v === null) data.endTime = null;
    else if (typeof v === "string") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid endTime" }, { status: 400 });
      }
      data.endTime = d;
    } else {
      return NextResponse.json({ error: "endTime must be string or null" }, { status: 400 });
    }
  }

  if ("title" in body) {
    data.title = body.title === null ? null : String(body.title);
  }
  if ("color" in body) {
    data.color = body.color === null ? null : String(body.color);
  }
  if ("calendarStatus" in body) {
    data.calendarStatus =
      body.calendarStatus === null ? null : String(body.calendarStatus);
  }

  if ("duplex" in body) {
    if (body.duplex === null) data.duplex = null;
    else if (typeof body.duplex === "boolean") data.duplex = body.duplex;
    else {
      return NextResponse.json({ error: "duplex must be boolean or null" }, { status: 400 });
    }
  }

  if ("paperGsm" in body) {
    if (body.paperGsm === null) data.paperGsm = null;
    else if (typeof body.paperGsm === "number" && Number.isFinite(body.paperGsm)) {
      data.paperGsm = Math.max(0, Math.round(body.paperGsm));
    } else {
      return NextResponse.json({ error: "paperGsm must be number or null" }, { status: 400 });
    }
  }

  if ("resourceId" in body) {
    const v = body.resourceId;
    if (v === null) {
      data.machine = { disconnect: true };
    } else if (typeof v === "string") {
      const m = await prisma.printPressMachine.findUnique({ where: { slug: v } });
      if (!m) {
        return NextResponse.json({ error: `Unknown machine slug: ${v}` }, { status: 400 });
      }
      if (!machineSlugAllowedForUser(sess, m.id)) {
        return NextResponse.json(
          { error: "You can only schedule jobs on your assigned press." },
          { status: 403 },
        );
      }
      data.machine = { connect: { id: m.id } };
    } else {
      return NextResponse.json({ error: "resourceId must be string or null" }, { status: 400 });
    }
  }

  if (body.recalculateEndFromPressSpeed === true) {
    let machineRow = null;
    if (typeof body.resourceId === "string") {
      machineRow = await prisma.printPressMachine.findUnique({ where: { slug: body.resourceId } });
    } else if (existingRow.machineId) {
      machineRow = await prisma.printPressMachine.findUnique({ where: { id: existingRow.machineId } });
    }
    const startRaw = data.startTime !== undefined ? data.startTime : existingRow.startTime;
    const startDate = startRaw instanceof Date ? startRaw : null;
    if (machineRow && startDate && !Number.isNaN(startDate.getTime())) {
      const dup =
        "duplex" in body ? body.duplex === true : existingRow.duplex === true;
      const gsm =
        "paperGsm" in body && typeof body.paperGsm === "number"
          ? body.paperGsm
          : existingRow.paperGsm;
      const mins = estimatePlacementMinutes(machineRow, {
        sheetsToPress: existingRow.sheetsToPress,
        runSheetSize: existingRow.runSheetSize,
        stockDescription: existingRow.stockDescription,
        duplex: dup,
        paperGsm: gsm,
      });
      if (mins != null) {
        data.endTime = new Date(startDate.getTime() + mins * 60_000);
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 },
    );
  }

  try {
    const job = await prisma.printScheduleJob.update({
      where: { id },
      data,
      include: { machine: true },
    });
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Job not found or update failed." }, { status: 404 });
  }
}
