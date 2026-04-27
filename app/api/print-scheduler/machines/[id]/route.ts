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

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canManageMachines");
  if (allowed !== true) return allowed;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    name?: string;
    sortOrder?: number;
    pressType?: string;
    speedSheetsPerHour?: number | null;
    speedPagesPerMinute?: number | null;
    speedMatrixJson?: string | null;
  } = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.floor(body.sortOrder);
  }
  if (typeof body.pressType === "string") {
    data.pressType = normalizePressType(body.pressType);
    if (data.pressType === PRESS_TYPE_TONER) {
      data.speedSheetsPerHour = null;
      data.speedMatrixJson = null;
    } else if (data.pressType === PRESS_TYPE_DIGITAL_IPM_MATRIX) {
      data.speedSheetsPerHour = null;
      data.speedPagesPerMinute = null;
    } else {
      data.speedPagesPerMinute = null;
      data.speedMatrixJson = null;
    }
  }
  if ("speedSheetsPerHour" in body) {
    const v = body.speedSheetsPerHour;
    if (v === null) data.speedSheetsPerHour = null;
    else if (typeof v === "number" && Number.isFinite(v)) {
      data.speedSheetsPerHour = Math.max(0, Math.floor(v));
    } else {
      return NextResponse.json({ error: "Invalid speedSheetsPerHour" }, { status: 400 });
    }
  }
  if ("speedPagesPerMinute" in body) {
    const v = body.speedPagesPerMinute;
    if (v === null) data.speedPagesPerMinute = null;
    else if (typeof v === "number" && Number.isFinite(v)) {
      data.speedPagesPerMinute = Math.max(0, Math.floor(v));
    } else {
      return NextResponse.json({ error: "Invalid speedPagesPerMinute" }, { status: 400 });
    }
  }
  if ("speedMatrixJson" in body) {
    const v = body.speedMatrixJson;
    if (v === null || v === "") data.speedMatrixJson = null;
    else if (typeof v === "string") {
      const trimmed = v.trim();
      if (!parseSpeedMatrix(trimmed)) {
        return NextResponse.json(
          { error: "Invalid speedMatrixJson (need rules with size, sides, gsmMin, gsmMax, impressionsPerMinute)." },
          { status: 400 },
        );
      }
      data.speedMatrixJson = trimmed;
    } else {
      return NextResponse.json({ error: "speedMatrixJson must be string or null" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const machine = await prisma.printPressMachine.update({
      where: { id },
      data,
    });
    return NextResponse.json(machine);
  } catch {
    return NextResponse.json({ error: "Machine not found." }, { status: 404 });
  }
}
