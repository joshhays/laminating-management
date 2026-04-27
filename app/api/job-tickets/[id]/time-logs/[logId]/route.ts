import { JobTimeActivityKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { recalcJobTicketActualHours } from "@/lib/job-time-aggregates";
import { RUN_FILM_ERROR, applyRunFilmConsumption } from "@/lib/job-run-film-inventory";
import { getShopFloorSessionEmployee } from "@/lib/shop-floor/session";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; logId: string }> };

function parseSheetsRun(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, error: "sheetsRun is required to stop a run" };
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, error: "sheetsRun must be a whole number ≥ 1" };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, error: "sheetsRun must be a whole number" };
  }
  return { ok: true, value: n };
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: jobTicketId, logId } = await params;
  const emp = await getShopFloorSessionEmployee();
  if (!emp) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const log = await prisma.jobTimeLog.findFirst({
    where: { id: logId, jobTicketId },
  });
  if (!log) return NextResponse.json({ error: "Log not found" }, { status: 404 });
  if (log.employeeId !== emp.id) {
    return NextResponse.json({ error: "You can only stop your own timer" }, { status: 403 });
  }
  if (log.endedAt != null) {
    return NextResponse.json({ error: "Timer already stopped" }, { status: 400 });
  }

  let body: { notes?: string | null; sheetsRun?: unknown };
  try {
    body = (await request.json()) as { notes?: string | null; sheetsRun?: unknown };
  } catch {
    body = {};
  }
  const notesPatch =
    "notes" in body
      ? body.notes == null || body.notes === ""
        ? null
        : String(body.notes).trim().slice(0, 2000) || null
      : undefined;

  let sheetsRun: number | undefined;
  if (log.activityKind === JobTimeActivityKind.LINE_TIME) {
    const parsed = parseSheetsRun(body.sheetsRun);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    sheetsRun = parsed.value;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.jobTimeLog.update({
        where: { id: logId },
        data: {
          endedAt: new Date(),
          ...(log.activityKind === JobTimeActivityKind.LINE_TIME ? { sheetsRun } : {}),
          ...(notesPatch !== undefined ? { notes: notesPatch } : {}),
        },
        include: { employee: { select: { id: true, name: true } } },
      });
      if (
        log.activityKind === JobTimeActivityKind.LINE_TIME &&
        sheetsRun != null &&
        sheetsRun >= 1
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
            "Sheets ran would use more film than was planned for this job (allocation). Reduce the sheet count or adjust the job film allocation.",
        },
        { status: 400 },
      );
    }
    throw e;
  }
}
