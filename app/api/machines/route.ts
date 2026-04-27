import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  usesCutterEstimateFields,
  usesLaminatorLineFieldsCreate,
  usesSimpleEquipmentProfile,
} from "@/lib/machine-equipment-profile";

export async function GET() {
  const list = await prisma.machine.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      speedReductionRules: { orderBy: { sortOrder: "asc" } },
      machineType: true,
    },
  });
  return NextResponse.json(list);
}

function parseTechnicalSpecs(raw: unknown): Prisma.InputJsonValue {
  if (raw === undefined || raw === null) return {};
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

function readMakeReadyMinutes(body: Record<string, unknown>): number {
  if (body.makeReadyMinutes !== undefined) return Number(body.makeReadyMinutes ?? 0);
  if (body.setupTimeMinutes !== undefined) return Number(body.setupTimeMinutes ?? 0);
  return 0;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const machineTypeId =
      body.machineTypeId != null && String(body.machineTypeId).trim() !== ""
        ? String(body.machineTypeId).trim()
        : null;

    const mt = machineTypeId
      ? await prisma.machineType.findUnique({ where: { id: machineTypeId } })
      : null;
    const needsCutterFields = mt != null ? usesCutterEstimateFields(mt) : false;
    const needsLineFields = mt != null ? usesLaminatorLineFieldsCreate(mt) : true;
    const simpleProfile = mt != null ? usesSimpleEquipmentProfile(mt) : false;

    let maxWidthInches = Number(body.maxWidthInches);
    let maxSpeedMetersMin = Number(body.maxSpeedMetersMin);
    if (needsCutterFields || simpleProfile) {
      if (!Number.isFinite(maxWidthInches) || maxWidthInches <= 0) maxWidthInches = 100;
      if (!Number.isFinite(maxSpeedMetersMin) || maxSpeedMetersMin <= 0) maxSpeedMetersMin = 1;
    }
    const hourlyRate = Number(body.hourlyRate ?? 0);
    const laborHourlyRate = Number(body.laborHourlyRate ?? 0);
    const makeReadyMinutes = needsLineFields ? readMakeReadyMinutes(body) : 0;
    const extraMakeReadyDigitalMinutes = needsLineFields
      ? Number(body.extraMakeReadyDigitalMinutes ?? 0)
      : 0;
    const extraMakeReadyOffsetMinutes = needsLineFields
      ? Number(body.extraMakeReadyOffsetMinutes ?? 0)
      : 0;
    const sideChangeMinutes = needsLineFields ? Number(body.sideChangeMinutes ?? 0) : 0;
    const washUpMinutes = needsLineFields ? Number(body.washUpMinutes ?? 0) : 0;
    const spoilagePercent = Number(body.spoilagePercent ?? 0);
    const pricePerCut = Number(body.pricePerCut ?? 0);
    const maxTotalSlowdownPercent =
      body.maxTotalSlowdownPercent !== undefined && body.maxTotalSlowdownPercent !== null
        ? Number(body.maxTotalSlowdownPercent)
        : undefined;
    const notes = body.notes != null ? String(body.notes).trim() || null : null;
    const active = body.active !== false;

    const optDim = (k: string) =>
      body[k] !== undefined && body[k] !== null && String(body[k]).trim() !== ""
        ? Number(body[k])
        : null;

    let technicalSpecs: Prisma.InputJsonValue;
    try {
      technicalSpecs = parseTechnicalSpecs(body.technicalSpecs);
    } catch {
      return NextResponse.json({ error: "technicalSpecs must be valid JSON" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (
      needsLineFields &&
      (!Number.isFinite(maxWidthInches) || maxWidthInches <= 0)
    ) {
      return NextResponse.json({ error: "Max width must be a positive number (inches)" }, { status: 400 });
    }
    if (
      needsLineFields &&
      (!Number.isFinite(maxSpeedMetersMin) || maxSpeedMetersMin <= 0)
    ) {
      return NextResponse.json(
        { error: "Max speed must be a positive number (m/min)" },
        { status: 400 },
      );
    }

    const cutterBaseSetupHours = Number(body.cutterBaseSetupHours ?? 0);
    const cutterBuildLiftHours = Number(body.cutterBuildLiftHours ?? 0);
    const cutterAdditionalSetupHoursPerCut = Number(body.cutterAdditionalSetupHoursPerCut ?? 0);
    const cutterPerCutHours = Number(body.cutterPerCutHours ?? 0);
    const cutterMinCutsEnabled = Boolean(body.cutterMinCutsEnabled);
    const cutterMakeReadySpoilagePercent =
      body.cutterMakeReadySpoilagePercent !== undefined &&
      body.cutterMakeReadySpoilagePercent !== null &&
      String(body.cutterMakeReadySpoilagePercent).trim() !== ""
        ? Number(body.cutterMakeReadySpoilagePercent)
        : null;
    if (
      ![
        hourlyRate,
        laborHourlyRate,
        makeReadyMinutes,
        extraMakeReadyDigitalMinutes,
        extraMakeReadyOffsetMinutes,
        sideChangeMinutes,
        washUpMinutes,
        spoilagePercent,
        pricePerCut,
      ].every((n) => Number.isFinite(n) && n >= 0)
    ) {
      return NextResponse.json({ error: "Rates and times must be non-negative" }, { status: 400 });
    }
    if (spoilagePercent > 100) {
      return NextResponse.json({ error: "Spoilage % cannot exceed 100" }, { status: 400 });
    }
    if (
      ![
        cutterBaseSetupHours,
        cutterBuildLiftHours,
        cutterAdditionalSetupHoursPerCut,
        cutterPerCutHours,
      ].every((n) => Number.isFinite(n) && n >= 0)
    ) {
      return NextResponse.json({ error: "Cutter time fields must be non-negative" }, { status: 400 });
    }
    if (
      cutterMakeReadySpoilagePercent != null &&
      (!Number.isFinite(cutterMakeReadySpoilagePercent) ||
        cutterMakeReadySpoilagePercent < 0 ||
        cutterMakeReadySpoilagePercent > 100)
    ) {
      return NextResponse.json(
        { error: "Cutter make ready spoilage must be 0–100 or blank" },
        { status: 400 },
      );
    }
    if (needsCutterFields) {
      const om = optDim("cutterOversizeMinLongEdgeInches");
      const ol = optDim("cutterOversizeMaxLiftHeightInches");
      const chRaw = body.cutterHelperLaborHourlyRate;
      const ch =
        chRaw !== undefined && chRaw !== null && String(chRaw).trim() !== ""
          ? Number(chRaw)
          : null;
      if (om != null && (!Number.isFinite(om) || om <= 0)) {
        return NextResponse.json(
          { error: "Oversize long-edge threshold must be positive or blank" },
          { status: 400 },
        );
      }
      if (ol != null && (!Number.isFinite(ol) || ol <= 0)) {
        return NextResponse.json(
          { error: "Oversize max lift height must be positive or blank" },
          { status: 400 },
        );
      }
      if (ch != null && (!Number.isFinite(ch) || ch < 0)) {
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

    const row = await prisma.machine.create({
      data: {
        name,
        maxWidthInches,
        maxSpeedMetersMin,
        ...(maxTotalSlowdownPercent !== undefined ? { maxTotalSlowdownPercent } : {}),
        hourlyRate,
        laborHourlyRate,
        makeReadyMinutes,
        ...(needsLineFields
          ? {
              extraMakeReadyDigitalMinutes,
              extraMakeReadyOffsetMinutes,
            }
          : {}),
        sideChangeMinutes,
        washUpMinutes,
        spoilagePercent,
        pricePerCut,
        minSheetWidthInches: optDim("minSheetWidthInches"),
        maxSheetWidthInches: optDim("maxSheetWidthInches"),
        minSheetLengthInches: optDim("minSheetLengthInches"),
        maxSheetLengthInches: optDim("maxSheetLengthInches"),
        machineTypeId: machineTypeId ?? undefined,
        cutterMaxHeightInches: optDim("cutterMaxHeightInches"),
        cutterMaxWeight: optDim("cutterMaxWeight"),
        ...(needsCutterFields
          ? {
              cutterOversizeMinLongEdgeInches: optDim("cutterOversizeMinLongEdgeInches"),
              cutterOversizeMaxLiftHeightInches: optDim("cutterOversizeMaxLiftHeightInches"),
              cutterHelperLaborHourlyRate:
                body.cutterHelperLaborHourlyRate !== undefined &&
                body.cutterHelperLaborHourlyRate !== null &&
                String(body.cutterHelperLaborHourlyRate).trim() !== ""
                  ? Number(body.cutterHelperLaborHourlyRate)
                  : null,
            }
          : {}),
        cutterBaseSetupHours,
        cutterBuildLiftHours,
        cutterAdditionalSetupHoursPerCut,
        cutterPerCutHours,
        cutterMakeReadySpoilagePercent,
        cutterMinCutsEnabled,
        technicalSpecs: technicalSpecs ?? {},
        notes,
        active,
      },
      include: { speedReductionRules: { orderBy: { sortOrder: "asc" } }, machineType: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "BAD_JSON") {
      return NextResponse.json({ error: "technicalSpecs must be valid JSON" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
