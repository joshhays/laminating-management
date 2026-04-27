import { NextResponse } from "next/server";
import { requirePermission, requireSession } from "@/lib/print-scheduler/api-auth";
import { prisma } from "@/lib/prisma";
import { parseSpeedMatrix } from "@/lib/print-scheduler/digital-press-speed-matrix";
import {
  normalizePressType,
  PRESS_TYPE_DIGITAL_IPM_MATRIX,
  PRESS_TYPE_TONER,
} from "@/lib/print-scheduler/press-speed";

export const runtime = "nodejs";

export async function GET() {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canViewSchedule");
  if (allowed !== true) return allowed;

  try {
    if (sess.role === "MACHINE" && !sess.machineId) {
      return NextResponse.json([]);
    }
    const machines = await prisma.printPressMachine.findMany({
      where: sess.role === "MACHINE" && sess.machineId ? { id: sess.machineId } : undefined,
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        sortOrder: true,
        pressType: true,
        speedSheetsPerHour: true,
        speedPagesPerMinute: true,
        speedMatrixJson: true,
      },
    });
    return NextResponse.json(machines);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not load machines from the database.";
    console.error("[GET /api/machines]", e);
    return NextResponse.json(
      {
        error: message,
        hint:
          "Run `npx prisma generate` and `npx prisma db push` so the DB matches the schema (SchedulerUser / PrintPressMachine / PrintScheduleJob). SQLite: DATABASE_URL=\"file:./dev.db\".",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canManageMachines");
  if (allowed !== true) return allowed;

  try {
    let body: {
      slug?: string;
      name?: string;
      sortOrder?: number;
      pressType?: string;
      speedSheetsPerHour?: number | null;
      speedPagesPerMinute?: number | null;
      speedMatrixJson?: string | null;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!slug || !name) {
      return NextResponse.json({ error: "slug and name are required." }, { status: 400 });
    }
    const pressType = normalizePressType(body.pressType);
    const rawSph =
      body.speedSheetsPerHour === null || body.speedSheetsPerHour === undefined
        ? null
        : Math.max(0, Math.floor(body.speedSheetsPerHour));
    const rawPpm =
      body.speedPagesPerMinute === null || body.speedPagesPerMinute === undefined
        ? null
        : Math.max(0, Math.floor(body.speedPagesPerMinute));
    const rawMatrix =
      body.speedMatrixJson === null || body.speedMatrixJson === undefined
        ? null
        : String(body.speedMatrixJson).trim();
    if (pressType === PRESS_TYPE_DIGITAL_IPM_MATRIX && rawMatrix) {
      if (!parseSpeedMatrix(rawMatrix)) {
        return NextResponse.json(
          { error: "speedMatrixJson must be valid JSON with a non-empty rules array." },
          { status: 400 },
        );
      }
    }
    const machine = await prisma.printPressMachine.create({
      data: {
        slug,
        name,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
        pressType,
        speedSheetsPerHour:
          pressType === PRESS_TYPE_TONER || pressType === PRESS_TYPE_DIGITAL_IPM_MATRIX
            ? null
            : rawSph,
        speedPagesPerMinute: pressType === PRESS_TYPE_TONER ? rawPpm : null,
        speedMatrixJson:
          pressType === PRESS_TYPE_DIGITAL_IPM_MATRIX ? rawMatrix : null,
      },
    });
    return NextResponse.json(machine);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create machine.";
    console.error("[POST /api/machines]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
