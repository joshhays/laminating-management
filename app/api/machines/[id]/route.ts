import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function parseTechnicalSpecs(raw: unknown): Prisma.InputJsonValue | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return {};
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return {};
    try {
      return JSON.parse(t) as Prisma.InputJsonValue;
    } catch {
      throw new Error("BAD_JSON");
    }
  }
  return raw as Prisma.InputJsonValue;
}

function readOptionalMakeReady(body: Record<string, unknown>): number | undefined {
  if (body.makeReadyMinutes !== undefined) return Number(body.makeReadyMinutes);
  if (body.setupTimeMinutes !== undefined) return Number(body.setupTimeMinutes);
  return undefined;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const row = await prisma.machine.findUnique({
    where: { id },
    include: { speedReductionRules: { orderBy: { sortOrder: "asc" } }, machineType: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name !== undefined ? String(body.name ?? "").trim() : undefined;
    const maxWidthInches =
      body.maxWidthInches !== undefined ? Number(body.maxWidthInches) : undefined;
    const maxSpeedMetersMin =
      body.maxSpeedMetersMin !== undefined ? Number(body.maxSpeedMetersMin) : undefined;
    const hourlyRate = body.hourlyRate !== undefined ? Number(body.hourlyRate) : undefined;
    const laborHourlyRate =
      body.laborHourlyRate !== undefined ? Number(body.laborHourlyRate) : undefined;
    const makeReadyMinutes = readOptionalMakeReady(body);
    const extraMakeReadyDigitalMinutes =
      body.extraMakeReadyDigitalMinutes !== undefined
        ? Number(body.extraMakeReadyDigitalMinutes)
        : undefined;
    const extraMakeReadyOffsetMinutes =
      body.extraMakeReadyOffsetMinutes !== undefined
        ? Number(body.extraMakeReadyOffsetMinutes)
        : undefined;
    const sideChangeMinutes =
      body.sideChangeMinutes !== undefined ? Number(body.sideChangeMinutes) : undefined;
    const washUpMinutes = body.washUpMinutes !== undefined ? Number(body.washUpMinutes) : undefined;
    const spoilagePercent =
      body.spoilagePercent !== undefined ? Number(body.spoilagePercent) : undefined;
    const pricePerCut = body.pricePerCut !== undefined ? Number(body.pricePerCut) : undefined;
    const cutterMinCutsEnabled =
      body.cutterMinCutsEnabled !== undefined ? Boolean(body.cutterMinCutsEnabled) : undefined;
    const cutterBaseSetupHours =
      body.cutterBaseSetupHours !== undefined ? Number(body.cutterBaseSetupHours) : undefined;
    const cutterBuildLiftHours =
      body.cutterBuildLiftHours !== undefined ? Number(body.cutterBuildLiftHours) : undefined;
    const cutterAdditionalSetupHoursPerCut =
      body.cutterAdditionalSetupHoursPerCut !== undefined
        ? Number(body.cutterAdditionalSetupHoursPerCut)
        : undefined;
    const cutterPerCutHours =
      body.cutterPerCutHours !== undefined ? Number(body.cutterPerCutHours) : undefined;
    const cutterMakeReadySpoilagePercent =
      body.cutterMakeReadySpoilagePercent !== undefined
        ? body.cutterMakeReadySpoilagePercent === null ||
          String(body.cutterMakeReadySpoilagePercent).trim() === ""
          ? null
          : Number(body.cutterMakeReadySpoilagePercent)
        : undefined;
    const maxTotalSlowdownPercent =
      body.maxTotalSlowdownPercent !== undefined
        ? Number(body.maxTotalSlowdownPercent)
        : undefined;
    const notes =
      body.notes !== undefined ? String(body.notes ?? "").trim() || null : undefined;
    const active = body.active !== undefined ? Boolean(body.active) : undefined;
    let technicalSpecs: Prisma.InputJsonValue | undefined;
    if (body.technicalSpecs !== undefined) {
      technicalSpecs = parseTechnicalSpecs(body.technicalSpecs);
    }

    const optDim = (k: string): number | null | undefined => {
      if (body[k] === undefined) return undefined;
      if (body[k] === null || String(body[k]).trim() === "") return null;
      return Number(body[k]);
    };

    const machineTypeId =
      body.machineTypeId !== undefined
        ? body.machineTypeId === null || String(body.machineTypeId).trim() === ""
          ? null
          : String(body.machineTypeId).trim()
        : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (
      maxWidthInches !== undefined &&
      (!Number.isFinite(maxWidthInches) || maxWidthInches <= 0)
    ) {
      return NextResponse.json({ error: "Max width must be positive" }, { status: 400 });
    }
    if (
      maxSpeedMetersMin !== undefined &&
      (!Number.isFinite(maxSpeedMetersMin) || maxSpeedMetersMin <= 0)
    ) {
      return NextResponse.json({ error: "Max speed must be positive" }, { status: 400 });
    }
    if (
      (hourlyRate !== undefined && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) ||
      (laborHourlyRate !== undefined && (!Number.isFinite(laborHourlyRate) || laborHourlyRate < 0)) ||
      (makeReadyMinutes !== undefined &&
        (!Number.isFinite(makeReadyMinutes) || makeReadyMinutes < 0)) ||
      (extraMakeReadyDigitalMinutes !== undefined &&
        (!Number.isFinite(extraMakeReadyDigitalMinutes) ||
          extraMakeReadyDigitalMinutes < 0)) ||
      (extraMakeReadyOffsetMinutes !== undefined &&
        (!Number.isFinite(extraMakeReadyOffsetMinutes) || extraMakeReadyOffsetMinutes < 0)) ||
      (sideChangeMinutes !== undefined &&
        (!Number.isFinite(sideChangeMinutes) || sideChangeMinutes < 0)) ||
      (washUpMinutes !== undefined && (!Number.isFinite(washUpMinutes) || washUpMinutes < 0)) ||
      (spoilagePercent !== undefined &&
        (!Number.isFinite(spoilagePercent) || spoilagePercent < 0 || spoilagePercent > 100)) ||
      (pricePerCut !== undefined && (!Number.isFinite(pricePerCut) || pricePerCut < 0))
    ) {
      return NextResponse.json({ error: "Rates and times must be valid" }, { status: 400 });
    }
    if (
      (cutterBaseSetupHours !== undefined &&
        (!Number.isFinite(cutterBaseSetupHours) || cutterBaseSetupHours < 0)) ||
      (cutterBuildLiftHours !== undefined &&
        (!Number.isFinite(cutterBuildLiftHours) || cutterBuildLiftHours < 0)) ||
      (cutterAdditionalSetupHoursPerCut !== undefined &&
        (!Number.isFinite(cutterAdditionalSetupHoursPerCut) ||
          cutterAdditionalSetupHoursPerCut < 0)) ||
      (cutterPerCutHours !== undefined &&
        (!Number.isFinite(cutterPerCutHours) || cutterPerCutHours < 0))
    ) {
      return NextResponse.json(
        { error: "Cutter time fields must be non-negative numbers" },
        { status: 400 },
      );
    }
    if (
      cutterMakeReadySpoilagePercent !== undefined &&
      cutterMakeReadySpoilagePercent !== null &&
      (!Number.isFinite(cutterMakeReadySpoilagePercent) ||
        cutterMakeReadySpoilagePercent < 0 ||
        cutterMakeReadySpoilagePercent > 100)
    ) {
      return NextResponse.json(
        { error: "Cutter make ready spoilage must be 0–100 or blank" },
        { status: 400 },
      );
    }
    if (body.cutterOversizeMinLongEdgeInches !== undefined) {
      const v = optDim("cutterOversizeMinLongEdgeInches");
      const n = v === undefined ? null : v;
      if (n != null && (!Number.isFinite(n) || n <= 0)) {
        return NextResponse.json(
          { error: "Oversize long-edge threshold must be positive or blank" },
          { status: 400 },
        );
      }
    }
    if (body.cutterOversizeMaxLiftHeightInches !== undefined) {
      const v = optDim("cutterOversizeMaxLiftHeightInches");
      const n = v === undefined ? null : v;
      if (n != null && (!Number.isFinite(n) || n <= 0)) {
        return NextResponse.json(
          { error: "Oversize max lift height must be positive or blank" },
          { status: 400 },
        );
      }
    }
    if (body.cutterHelperLaborHourlyRate !== undefined) {
      const raw = body.cutterHelperLaborHourlyRate;
      const n =
        raw === null || (typeof raw === "string" && raw.trim() === "")
          ? null
          : Number(raw);
      if (n != null && (!Number.isFinite(n) || n < 0)) {
        return NextResponse.json(
          { error: "Helper labor rate must be non-negative or blank" },
          { status: 400 },
        );
      }
    }
    if (
      maxTotalSlowdownPercent !== undefined &&
      (!Number.isFinite(maxTotalSlowdownPercent) ||
        maxTotalSlowdownPercent < 0 ||
        maxTotalSlowdownPercent > 100)
    ) {
      return NextResponse.json(
        { error: "Max total slowdown must be between 0 and 100" },
        { status: 400 },
      );
    }

    const row = await prisma.machine.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(maxWidthInches !== undefined ? { maxWidthInches } : {}),
        ...(maxSpeedMetersMin !== undefined ? { maxSpeedMetersMin } : {}),
        ...(hourlyRate !== undefined ? { hourlyRate } : {}),
        ...(laborHourlyRate !== undefined ? { laborHourlyRate } : {}),
        ...(makeReadyMinutes !== undefined ? { makeReadyMinutes } : {}),
        ...(extraMakeReadyDigitalMinutes !== undefined
          ? { extraMakeReadyDigitalMinutes }
          : {}),
        ...(extraMakeReadyOffsetMinutes !== undefined
          ? { extraMakeReadyOffsetMinutes }
          : {}),
        ...(sideChangeMinutes !== undefined ? { sideChangeMinutes } : {}),
        ...(washUpMinutes !== undefined ? { washUpMinutes } : {}),
        ...(spoilagePercent !== undefined ? { spoilagePercent } : {}),
        ...(pricePerCut !== undefined ? { pricePerCut } : {}),
        ...(body.cutterMaxHeightInches !== undefined
          ? { cutterMaxHeightInches: optDim("cutterMaxHeightInches") ?? null }
          : {}),
        ...(body.cutterMaxWeight !== undefined
          ? { cutterMaxWeight: optDim("cutterMaxWeight") ?? null }
          : {}),
        ...(cutterBaseSetupHours !== undefined ? { cutterBaseSetupHours } : {}),
        ...(cutterBuildLiftHours !== undefined ? { cutterBuildLiftHours } : {}),
        ...(cutterAdditionalSetupHoursPerCut !== undefined
          ? { cutterAdditionalSetupHoursPerCut }
          : {}),
        ...(cutterPerCutHours !== undefined ? { cutterPerCutHours } : {}),
        ...(cutterMakeReadySpoilagePercent !== undefined
          ? { cutterMakeReadySpoilagePercent }
          : {}),
        ...(cutterMinCutsEnabled !== undefined ? { cutterMinCutsEnabled } : {}),
        ...(body.cutterOversizeMinLongEdgeInches !== undefined
          ? {
              cutterOversizeMinLongEdgeInches:
                optDim("cutterOversizeMinLongEdgeInches") ?? null,
            }
          : {}),
        ...(body.cutterOversizeMaxLiftHeightInches !== undefined
          ? {
              cutterOversizeMaxLiftHeightInches:
                optDim("cutterOversizeMaxLiftHeightInches") ?? null,
            }
          : {}),
        ...(body.cutterHelperLaborHourlyRate !== undefined
          ? {
              cutterHelperLaborHourlyRate:
                body.cutterHelperLaborHourlyRate === null ||
                String(body.cutterHelperLaborHourlyRate).trim() === ""
                  ? null
                  : Number(body.cutterHelperLaborHourlyRate),
            }
          : {}),
        ...(body.minSheetWidthInches !== undefined
          ? { minSheetWidthInches: optDim("minSheetWidthInches") ?? null }
          : {}),
        ...(body.maxSheetWidthInches !== undefined
          ? { maxSheetWidthInches: optDim("maxSheetWidthInches") ?? null }
          : {}),
        ...(body.minSheetLengthInches !== undefined
          ? { minSheetLengthInches: optDim("minSheetLengthInches") ?? null }
          : {}),
        ...(body.maxSheetLengthInches !== undefined
          ? { maxSheetLengthInches: optDim("maxSheetLengthInches") ?? null }
          : {}),
        ...(machineTypeId !== undefined ? { machineTypeId } : {}),
        ...(maxTotalSlowdownPercent !== undefined ? { maxTotalSlowdownPercent } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(technicalSpecs !== undefined ? { technicalSpecs } : {}),
      },
      include: { speedReductionRules: { orderBy: { sortOrder: "asc" } }, machineType: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof Error && e.message === "BAD_JSON") {
      return NextResponse.json({ error: "technicalSpecs must be valid JSON" }, { status: 400 });
    }
    return NextResponse.json({ error: "Not found or invalid" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.machine.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
