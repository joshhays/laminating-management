import {
  autoCutterWhereClause,
  usesCutterEstimateFields,
} from "@/lib/machine-equipment-profile";
import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { aggregateFilmForEstimate } from "@/lib/estimate-film-aggregate";
import { estimateCutterLaborAndCost } from "@/lib/cutter-estimate";
import { resolveCutterOversizeForEstimate } from "@/lib/cutter-oversize";
import { cutterLiftPlan } from "@/lib/cutter-lift-plan";
import { filmMaterialTypeLabel } from "@/lib/film-material-type";
import { getFilmMaterialLabelMap } from "@/lib/film-material-service";
import { estimateConversionFromRunBreakdown } from "@/lib/job-conversion-costs";
import { validateSheetAgainstMachineBounds } from "@/lib/machine-sheet-bounds";
import { estimateTotalRunTimeFromMachine } from "@/lib/machine-run-time";
import { resolveCutterSheetThicknessInches } from "@/lib/cutter-sheet-thickness";
import { gsmFromPaperCaliperPt, parseLooseBasisLb } from "@/lib/paper-ref";
import { loadPaperRefRowsSync } from "@/lib/paper-ref-load";
import {
  basisKindFromEstimatePaperGrade,
  parsePaperSpecificationToGsm,
} from "@/lib/paper-spec-to-gsm";
import { spoilagePercentForQuantity } from "@/lib/spoilage-rules";
import { productionSheetCount } from "@/lib/spoilage";
import { parseEstimatePaperColorInput } from "@/lib/estimate-paper-color";
import {
  computeCutterBaseCutsFromTrim,
  finishedPieceCount,
  parentFinalDimensionsDifferForCutter,
  totalCutterStrokes,
} from "@/lib/cutter-trim";
import {
  DEFAULT_MAX_SKID_WEIGHT_LBS,
  DEFAULT_MAX_STACK_HEIGHT_INCHES,
  estimateSkidPack,
} from "@/lib/skid-pack-estimate";
import { LAMINATE_WIDTH_INSET_INCHES } from "@/lib/estimate-math";
import { calculatePiecesPerSheetAtFinalTrim, calculateTrimImpositionBest } from "@/lib/print-cuts";
import {
  MAX_ESTIMATE_LINES,
  ESTIMATE_LINE_LABEL_MAX,
  allocateCostsToLines,
  type EstimateLineInput,
} from "@/lib/estimate-lines";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type CrmContactForEstimate = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  company: { name: string; address: string | null; creditLimit: number | null };
};

function normalizePrintProcess(raw: string): "Digital" | "Offset" | null {
  const t = raw.trim().toLowerCase();
  if (t === "digital") return "Digital";
  if (t === "offset") return "Offset";
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseOrderLines(body: unknown): EstimateLineInput[] | "invalid" {
  if (!isRecord(body)) return "invalid";
  if (Array.isArray(body.lines) && body.lines.length > 0) {
    if (body.lines.length > MAX_ESTIMATE_LINES) return "invalid";
    const out: EstimateLineInput[] = [];
    for (const row of body.lines) {
      if (!isRecord(row)) return "invalid";
      const q = Math.floor(Number(row.quantity));
      if (!Number.isInteger(q) || q <= 0) return "invalid";
      const labelRaw = row.label != null ? String(row.label).trim() : "";
      out.push({
        label: labelRaw.slice(0, ESTIMATE_LINE_LABEL_MAX),
        quantity: q,
      });
    }
    return out;
  }
  const q = Math.floor(Number(body.quantity));
  if (!Number.isInteger(q) || q <= 0) return "invalid";
  return [{ label: "", quantity: q }];
}

async function filmTypeLabel(roll: {
  materialType: string;
  description: string;
  thicknessMil: number;
  rollWidth: number;
}) {
  const map = await getFilmMaterialLabelMap();
  return `${filmMaterialTypeLabel(roll.materialType, map)} — ${roll.description}, ${roll.thicknessMil} mil, ${roll.rollWidth} in roll`;
}

export type ComputeEstimateFail = { ok: false; status: number; error: string };

export type ComputeEstimateSuccess = {
  ok: true;
  createData: Prisma.EstimateUncheckedCreateInput;
  totalCost: number;
  accountingReviewRequired: boolean;
  companyId: string;
  contactId: string;
  machineId: string | null;
  crmContact: CrmContactForEstimate;
  primary: { estimatedLinearFeet: number };
  agg: {
    totalMaterialSquareInches: number;
    totalFilmFromRollSquareInches: number;
    totalCostFromFilm: number;
  };
  estimatedMachineCost: number | null;
  estimatedLaborCost: number | null;
  estimatedCutCount: number | null;
  estimatedCutterSheetsPerLift: number | null;
  estimatedCutterLiftCount: number | null;
  estimatedCutterLaborHours: number | null;
  estimatedCutterMachineOnlyCost: number | null;
  estimatedCutterLaborOnlyCost: number | null;
  estimatedCutterCost: number | null;
  estimatedSkidPackCost: number | null;
  estimatedSkidPackInboundSkids: number | null;
  estimatedSkidPackOutboundSkids: number | null;
  skidPackPricePerSkidSnapshot: number | null;
};

export async function computeEstimateForCreate(
  prisma: PrismaClient,
  body: Record<string, unknown>,
  ctx: { companyId: string; contactId: string; crmContact: CrmContactForEstimate },
): Promise<ComputeEstimateFail | ComputeEstimateSuccess> {
  const { companyId, contactId, crmContact } = ctx;
  try {
  const laminationRequired = body.laminationRequired !== false;
  const filmInventoryId = String(body.filmInventoryId ?? "").trim();
  const sheetLengthInches = Number(body.sheetLengthInches);
  const orderLines = parseOrderLines(body);
  if (orderLines === "invalid") {
    throw new HttpError(400, "Add at least one part with a positive whole-number sheet quantity (or use the legacy single quantity field).");
  }
  const quantity = orderLines.reduce((s, l) => s + l.quantity, 0);
  const materialWidthInches = Number(body.materialWidthInches);

  const secondPassEnabled = laminationRequired && Boolean(body.secondPassEnabled);
  const secondFilmSameAsFirst = body.secondFilmSameAsFirst !== false;
  const secondFilmInventoryIdRaw =
    body.secondFilmInventoryId != null ? String(body.secondFilmInventoryId).trim() : "";
  const secondFilmInventoryId = secondFilmInventoryIdRaw || null;

  const finalW =
    body.finalSheetWidthInches != null && String(body.finalSheetWidthInches).trim() !== ""
      ? Number(body.finalSheetWidthInches)
      : null;
  const finalL =
    body.finalSheetLengthInches != null && String(body.finalSheetLengthInches).trim() !== ""
      ? Number(body.finalSheetLengthInches)
      : null;

  const finalTrimNoBleedDutchCut = body.finalTrimNoBleedDutchCut !== false;
  const finalTrimIsPressReady = body.isPressReady === true || body.finalTrimIsPressReady === true;
  const includesFinalDelivery = body.includesFinalDelivery === true;
  const finalDeliveryNotesRaw =
    body.finalDeliveryNotes != null ? String(body.finalDeliveryNotes).trim() : "";
  const finalDeliveryNotes =
    finalDeliveryNotesRaw.length > 0 ? finalDeliveryNotesRaw.slice(0, 2000) : null;
  let finalDeliveryCostUsd: number | null = null;
  if (includesFinalDelivery) {
    const raw =
      body.finalDeliveryCostUsd != null && String(body.finalDeliveryCostUsd).trim() !== ""
        ? Number(body.finalDeliveryCostUsd)
        : 0;
    if (!Number.isFinite(raw) || raw < 0) {
      throw new HttpError(400, "Final delivery amount must be a non-negative number.");
    }
    finalDeliveryCostUsd = raw;
  }

  const skidPackEnabled = body.skidPackEnabled === true;

  if (laminationRequired && !filmInventoryId) {
    throw new HttpError(400, "Select a film roll");
  }
  if (!Number.isFinite(sheetLengthInches) || sheetLengthInches <= 0) {
    throw new HttpError(400, "Sheet length must be a positive number (inches)");
  }
  if (!Number.isFinite(materialWidthInches) || materialWidthInches <= 0) {
    throw new HttpError(400, "Sheet width must be a positive number (inches)");
  }

  const laminateWidthInsetInchesParsed =
    body.laminateWidthInsetInches != null && String(body.laminateWidthInsetInches).trim() !== ""
      ? Number(body.laminateWidthInsetInches)
      : LAMINATE_WIDTH_INSET_INCHES;
  const laminateWidthInsetInches = laminateWidthInsetInchesParsed;
  if (
    !Number.isFinite(laminateWidthInsetInches) ||
    laminateWidthInsetInches < 0.125 ||
    laminateWidthInsetInches > 3
  ) {
    throw new HttpError(
      400,
      "Cross-web bare margin (laminateWidthInsetInches) must be between 0.125 and 3 inches.",
    );
  }
  if (laminateWidthInsetInches >= materialWidthInches - 1e-9) {
    throw new HttpError(
      400,
      "Cross-web bare margin must be less than sheet width so laminate width is positive.",
    );
  }

  if (secondPassEnabled && !secondFilmSameAsFirst && !secondFilmInventoryId) {
    throw new HttpError(400, "Select a second film roll, or use the same film for both passes.");
  }

  if (finalW != null && (!Number.isFinite(finalW) || finalW <= 0)) {
    throw new HttpError(400, "Final width must be positive when set");
  }
  if (finalL != null && (!Number.isFinite(finalL) || finalL <= 0)) {
    throw new HttpError(400, "Final length must be positive when set");
  }

  const trimRequiresCutter = parentFinalDimensionsDifferForCutter(
    materialWidthInches,
    sheetLengthInches,
    finalW,
    finalL,
  );

  let cutterMachineId: string | null = null;
  if (trimRequiresCutter) {
    const autoCutter = await prisma.machine.findFirst({
      where: { active: true, AND: [autoCutterWhereClause()] },
      orderBy: { name: "asc" },
    });
    if (!autoCutter) {
      throw new HttpError(400, "Final trim size differs from the parent sheet. Add an active cutter under Module setup → Estimating → Finishing machines (or legacy Cutter type).");
    }
    cutterMachineId = autoCutter.id;
  }

  const printTypeRaw = String(body.printProcess ?? body.printType ?? "").trim();
  const printTypeNorm = normalizePrintProcess(printTypeRaw);
  if (!printTypeNorm) {
    throw new HttpError(400, "Select print process: Digital or Offset");
  }

  const stockType = String(body.stockType ?? "").trim();
  if (!stockType || stockType === "*") {
    throw new HttpError(400, "Select or enter a stock / substrate type (paper)");
  }

  const paperCaliperPtRaw =
    body.paperCaliperPt != null && String(body.paperCaliperPt).trim() !== ""
      ? Number(body.paperCaliperPt)
      : NaN;
  const paperCaliperPt =
    Number.isFinite(paperCaliperPtRaw) && paperCaliperPtRaw > 0 ? paperCaliperPtRaw : null;

  const paperColor = parseEstimatePaperColorInput(body.paperColor);
  if (paperColor === null) {
    throw new HttpError(400, "Paper color must be White or Colored");
  }

  const paperDescription = String(body.paperDescription ?? "").trim();
  const bodyGsmRaw = body.paperGsm;
  const bodyGsm =
    bodyGsmRaw !== undefined && bodyGsmRaw !== null && String(bodyGsmRaw).trim() !== ""
      ? Number(bodyGsmRaw)
      : NaN;

  const basisKindHint = basisKindFromEstimatePaperGrade(stockType);
  const parsedFromDescription = parsePaperSpecificationToGsm(
    paperDescription,
    basisKindHint ? { basisKindHint } : undefined,
  );
  const looseBasisLbInDescription = parseLooseBasisLb(paperDescription);
  const hasBasisLbInDescription =
    (parsedFromDescription.basisLb != null && parsedFromDescription.basisLb > 0) ||
    (looseBasisLbInDescription != null && looseBasisLbInDescription > 0);

  const gsmFromPtWhenNoBasisLb: number | null =
    paperCaliperPt != null && !hasBasisLbInDescription
      ? gsmFromPaperCaliperPt(paperCaliperPt)
      : null;

  if (!paperDescription) {
    const hasGsmField = Number.isFinite(bodyGsm) && bodyGsm > 0;
    if (!hasGsmField && gsmFromPtWhenNoBasisLb == null) {
      throw new HttpError(
        400,
        "Describe the paper (e.g. 100# Coated Cover — we convert # / lb to GSM for speed rules), enter GSM, or caliper (pt) when basis lb is not used (GSM = pt × 25).",
      );
    }
  }

  let paperGsm: number;
  if (Number.isFinite(bodyGsm) && bodyGsm > 0) {
    paperGsm = bodyGsm;
  } else if (parsedFromDescription.gsm != null && parsedFromDescription.gsm > 0) {
    paperGsm = parsedFromDescription.gsm;
  } else if (gsmFromPtWhenNoBasisLb != null && Number.isFinite(gsmFromPtWhenNoBasisLb)) {
    paperGsm = gsmFromPtWhenNoBasisLb;
  } else {
    throw new HttpError(
      400,
      "Could not determine GSM — use a US basis callout (e.g. 100# Coated Cover, 80 lb text), type GSM, or caliper (pt) when basis lb is not used (GSM = pt × 25).",
    );
  }

  const machineIdRaw = body.machineId != null ? String(body.machineId).trim() : "";
  const machineId = laminationRequired ? (machineIdRaw || null) : null;

  let roll: Awaited<ReturnType<typeof prisma.filmInventory.findUnique>> = null;
  let pricePerFilmSquareInch = 0;
  if (laminationRequired) {
    roll = await prisma.filmInventory.findUnique({
      where: { id: filmInventoryId },
    });
    if (!roll) {
      throw new HttpError(404, "Film roll not found");
    }
    pricePerFilmSquareInch = roll.pricePerFilmSquareInch;
    if (!Number.isFinite(pricePerFilmSquareInch) || pricePerFilmSquareInch < 0) {
      throw new HttpError(400, "Film roll has an invalid price; update it in Film inventory.");
    }
  }

  let secondRoll: Awaited<ReturnType<typeof prisma.filmInventory.findUnique>> = null;
  if (secondPassEnabled && !secondFilmSameAsFirst && secondFilmInventoryId) {
    secondRoll = await prisma.filmInventory.findUnique({
      where: { id: secondFilmInventoryId },
    });
    if (!secondRoll) {
      throw new HttpError(404, "Second film roll not found");
    }
    if (!Number.isFinite(secondRoll.pricePerFilmSquareInch) || secondRoll.pricePerFilmSquareInch < 0) {
      throw new HttpError(400, "Second film roll has an invalid price; update it in Film inventory.");
    }
  }

  const machine = machineId
    ? await prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          speedReductionRules: { orderBy: { sortOrder: "asc" } },
          spoilageRules: { orderBy: { sortOrder: "asc" } },
        },
      })
    : null;
  if (machineId && !machine) {
    throw new HttpError(400, "Machine not found");
  }

  let spoilagePercent = 0;
  if (machine) {
    const fallback = Number.isFinite(machine.spoilagePercent) ? machine.spoilagePercent : 0;
    const gradeBasis = basisKindFromEstimatePaperGrade(stockType);
    const spoilagePaperBasis =
      gradeBasis === "text" || gradeBasis === "cover" ? gradeBasis : null;
    spoilagePercent = spoilagePercentForQuantity(
      quantity,
      machine.spoilageRules.map((r) => ({
        sortOrder: r.sortOrder,
        quantityMin: r.quantityMin,
        quantityMax: r.quantityMax,
        spoilagePercent: r.spoilagePercent,
        paperBasis: r.paperBasis,
      })),
      fallback,
      { paperBasis: spoilagePaperBasis, secondPass: secondPassEnabled },
    );
    const boundsCheck = validateSheetAgainstMachineBounds(materialWidthInches, sheetLengthInches, {
      minSheetWidthInches: machine.minSheetWidthInches,
      maxSheetWidthInches: machine.maxSheetWidthInches,
      minSheetLengthInches: machine.minSheetLengthInches,
      maxSheetLengthInches: machine.maxSheetLengthInches,
    });
    if (!boundsCheck.ok) {
      throw new HttpError(400, String(boundsCheck.message));
    }
  }

  const productionQty = productionSheetCount(quantity, spoilagePercent);

  let finalTrimPiecesPerSheet = 1;
  let finalTrimImpositionRotated = false;
  const trimYieldOpts = {
    noBleedDutchCut: finalTrimNoBleedDutchCut,
    isPressReady: finalTrimIsPressReady,
  };

  if (finalW != null && finalL != null) {
    finalTrimPiecesPerSheet = calculatePiecesPerSheetAtFinalTrim(
      materialWidthInches,
      sheetLengthInches,
      finalW,
      finalL,
      trimYieldOpts,
    );
    if (finalTrimPiecesPerSheet < 1) {
      throw new HttpError(400, "No finished pieces fit for this trim size. Bleed layout reserves 0.25 in on all sides unless you select Dutch cut or press-ready sheet. Adjust sizes.");
    }
    const lay = calculateTrimImpositionBest(
      materialWidthInches,
      sheetLengthInches,
      finalW,
      finalL,
      finalTrimNoBleedDutchCut,
      { isPressReady: finalTrimIsPressReady },
    );
    finalTrimImpositionRotated = lay.rotated;
  }

  const estimatedFinishedPieceCount = finishedPieceCount(quantity, finalTrimPiecesPerSheet);

  let estimatedCutCount: number | null = null;
  let estimatedCutterLaborHours: number | null = null;
  let estimatedCutterCost: number | null = null;
  let estimatedCutterMachineOnlyCost: number | null = null;
  let estimatedCutterLaborOnlyCost: number | null = null;
  let estimatedCutterLiftCount: number | null = null;
  let estimatedCutterSheetsPerLift: number | null = null;
  let sheetThicknessInches: number | null = null;

  const sheetThicknessRaw =
    body.sheetThicknessInches != null && String(body.sheetThicknessInches).trim() !== ""
      ? Number(body.sheetThicknessInches)
      : null;

  if (cutterMachineId) {
    const cutter = await prisma.machine.findUnique({
      where: { id: cutterMachineId },
      include: { machineType: true },
    });
    if (!cutter) {
      throw new HttpError(400, "Cutter machine not found");
    }
    if (!usesCutterEstimateFields(cutter.machineType)) {
      throw new HttpError(400, "Trim estimates require a cutter (finishing subtype Cutter or legacy Cutter type).");
    }
    if (finalW == null || finalL == null) {
      throw new HttpError(400, "Enter final width and length when adding a cutter.");
    }
    const geo = computeCutterBaseCutsFromTrim(
      materialWidthInches,
      sheetLengthInches,
      finalW,
      finalL,
      finalTrimNoBleedDutchCut,
      finalTrimIsPressReady,
    );
    if (!geo.ok) {
      throw new HttpError(400, String(geo.error));
    }

    const cutProfile = {
      cutterBaseSetupHours: cutter.cutterBaseSetupHours,
      cutterBuildLiftHours: cutter.cutterBuildLiftHours,
      cutterAdditionalSetupHoursPerCut: cutter.cutterAdditionalSetupHoursPerCut,
      cutterPerCutHours: cutter.cutterPerCutHours,
    };

    if (geo.baseCuts <= 0) {
      estimatedCutCount = 0;
    } else {
      let paperRefRows;
      try {
        paperRefRows = loadPaperRefRowsSync();
      } catch {
        throw new HttpError(400, "Paper reference file is missing or unreadable (Paper Reference/PaperRef.csv). Add it or enter sheet thickness manually.");
      }
      const thickRes = resolveCutterSheetThicknessInches({
        stockType,
        paperDescription,
        paperRefRows,
        manualInches: sheetThicknessRaw,
        paperCaliperPt,
      });
      if (!thickRes.ok) {
        throw new HttpError(400, String(thickRes.error));
      }
      sheetThicknessInches = thickRes.inches;
      const oversizeRes = resolveCutterOversizeForEstimate({
        sheetWidthInches: finalW,
        sheetLengthInches: finalL,
        cutterMaxHeightInches: cutter.cutterMaxHeightInches,
        cutterOversizeMinLongEdgeInches: cutter.cutterOversizeMinLongEdgeInches,
        cutterOversizeMaxLiftHeightInches: cutter.cutterOversizeMaxLiftHeightInches,
        laborHourlyRate: Number.isFinite(cutter.laborHourlyRate) ? cutter.laborHourlyRate : 0,
        cutterHelperLaborHourlyRate: cutter.cutterHelperLaborHourlyRate,
      });
      const liftPlan = cutterLiftPlan(
        productionQty,
        thickRes.inches,
        oversizeRes.effectiveLiftMaxHeightInches,
      );
      if (!liftPlan.ok) {
        throw new HttpError(400, String(liftPlan.error));
      }
      const totalCutStrokes = totalCutterStrokes(geo.baseCuts, liftPlan.numLifts);
      estimatedCutCount = totalCutStrokes;
      const machineRate = Number.isFinite(cutter.hourlyRate) ? cutter.hourlyRate : 0;
      const labor = estimateCutterLaborAndCost(
        totalCutStrokes,
        productionQty,
        thickRes.inches,
        oversizeRes.effectiveLiftMaxHeightInches,
        cutProfile,
        machineRate,
        oversizeRes.effectiveLaborHourlyRate,
      );
      if (!labor.ok) {
        throw new HttpError(400, String(labor.error));
      }
      estimatedCutterLiftCount = labor.numLifts;
      estimatedCutterSheetsPerLift = labor.sheetsPerLift;
      estimatedCutterLaborHours = labor.hours;
      estimatedCutterMachineOnlyCost = labor.cost.machine;
      estimatedCutterLaborOnlyCost = labor.cost.labor;
      estimatedCutterCost = labor.cost.total;
    }
  }

  let estimatedSkidPackInboundSkids: number | null = null;
  let estimatedSkidPackOutboundSkids: number | null = null;
  let estimatedSkidPackCost: number | null = null;
  let skidPackPricePerSkidSnapshot: number | null = null;

  if (skidPackEnabled) {
    if (sheetThicknessInches == null) {
      let paperRefRowsPack;
      try {
        paperRefRowsPack = loadPaperRefRowsSync();
      } catch {
        throw new HttpError(400, "Paper reference file is missing or unreadable (Paper Reference/PaperRef.csv). Add it or enter sheet thickness manually for skid pack.");
      }
      const thickResPack = resolveCutterSheetThicknessInches({
        stockType,
        paperDescription,
        paperRefRows: paperRefRowsPack,
        manualInches: sheetThicknessRaw,
        paperCaliperPt,
      });
      if (!thickResPack.ok) {
        throw new HttpError(400, String(thickResPack.error));
      }
      sheetThicknessInches = thickResPack.inches;
    }

    const settings = await prisma.skidPackSettings.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        pricePerSkidUsd: 0,
        maxStackHeightInches: DEFAULT_MAX_STACK_HEIGHT_INCHES,
        maxSkidWeightLbs: DEFAULT_MAX_SKID_WEIGHT_LBS,
      },
      update: {},
    });
    const pricePerSkid = Number.isFinite(settings.pricePerSkidUsd) ? settings.pricePerSkidUsd : 0;
    skidPackPricePerSkidSnapshot = pricePerSkid;
    const maxStackH =
      Number.isFinite(settings.maxStackHeightInches) && settings.maxStackHeightInches > 0
        ? settings.maxStackHeightInches
        : DEFAULT_MAX_STACK_HEIGHT_INCHES;
    const maxSkidLb =
      Number.isFinite(settings.maxSkidWeightLbs) && settings.maxSkidWeightLbs > 0
        ? settings.maxSkidWeightLbs
        : DEFAULT_MAX_SKID_WEIGHT_LBS;

    const finW = finalW ?? materialWidthInches;
    const finL = finalL ?? sheetLengthInches;
    if (!Number.isFinite(finW) || finW <= 0 || !Number.isFinite(finL) || finL <= 0) {
      throw new HttpError(400, "Enter valid sheet and/or final dimensions for skid pack.");
    }

    const secondMil =
      laminationRequired && secondPassEnabled && !secondFilmSameAsFirst && secondRoll
        ? secondRoll.thicknessMil
        : null;

    const skid = estimateSkidPack({
      productionSheetCount: productionQty,
      finalTrimPiecesPerSheet,
      parentWidthInches: materialWidthInches,
      parentLengthInches: sheetLengthInches,
      finishedWidthInches: finW,
      finishedLengthInches: finL,
      substrateThicknessInches: sheetThicknessInches,
      primaryFilmThicknessMil: laminationRequired && roll ? roll.thicknessMil : 0,
      secondPassEnabled,
      secondFilmSameAsFirst,
      secondFilmThicknessMil: secondMil,
      pricePerSkidUsd: pricePerSkid,
      maxStackHeightInches: maxStackH,
      maxSkidWeightLbs: maxSkidLb,
      paperGsm,
    });

    if (!skid) {
      throw new HttpError(400, "Could not compute skid pack (check caliper, film thickness, and sizes).");
    }

    estimatedSkidPackInboundSkids = skid.inboundSkids;
    estimatedSkidPackOutboundSkids = skid.outboundSkids;
    estimatedSkidPackCost = skid.costUsd;
  }

  let agg: ReturnType<typeof aggregateFilmForEstimate>;
  if (laminationRequired && roll) {
    try {
      agg = aggregateFilmForEstimate({
        productionQuantity: productionQty,
        sheetLengthInches,
        materialWidthInches,
        firstRoll: { rollWidth: roll.rollWidth, pricePerFilmSquareInch },
        secondPassEnabled,
        secondFilmSameAsFirst,
        secondRoll:
          secondPassEnabled && !secondFilmSameAsFirst && secondRoll
            ? {
                rollWidth: secondRoll.rollWidth,
                pricePerFilmSquareInch: secondRoll.pricePerFilmSquareInch,
              }
            : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid dimensions";
      throw new HttpError(400, String(msg));
    }
  } else {
    const lw = materialWidthInches - laminateWidthInsetInches;
    const matSq = productionQty * materialWidthInches * sheetLengthInches;
    const primaryNoFilm = {
      linearInches: 0,
      estimatedLinearFeet: 0,
      laminateWidthInches: Number.isFinite(lw) && lw > 0 ? lw : 0,
      slitExcessWidthInches: 0,
      materialSquareInches: matSq,
      laminateFilmSquareInches: 0,
      filmFromRollSquareInches: 0,
      slitWasteSquareInches: 0,
      totalCostFromFilm: 0,
    };
    agg = {
      primary: primaryNoFilm,
      secondPass: null,
      totalCostFromFilm: 0,
      totalFilmFromRollSquareInches: 0,
      totalLaminateFilmSquareInches: 0,
      totalSlitWasteSquareInches: 0,
      totalMaterialSquareInches: matSq,
    };
  }

  const passCount: 1 | 2 = secondPassEnabled ? 2 : 1;
  const primary = agg.primary;

  let estimatedRunTimeMinutes: number | null = null;
  let effectiveLineSpeedMpm: number | null = null;
  let estimatedMachineCost: number | null = null;
  let estimatedLaborCost: number | null = null;

  if (laminationRequired && machineId && machine && roll) {
    const br = estimateTotalRunTimeFromMachine(
      {
        maxSpeedMetersMin: machine.maxSpeedMetersMin,
        maxTotalSlowdownPercent: machine.maxTotalSlowdownPercent,
        makeReadyMinutes: machine.makeReadyMinutes,
        extraMakeReadyDigitalMinutes: machine.extraMakeReadyDigitalMinutes,
        extraMakeReadyOffsetMinutes: machine.extraMakeReadyOffsetMinutes,
        sideChangeMinutes: machine.sideChangeMinutes,
        washUpMinutes: machine.washUpMinutes,
        speedReductionRules: machine.speedReductionRules.map((r) => ({
          sortOrder: r.sortOrder,
          name: r.name,
          paperGsmMin: r.paperGsmMin,
          paperGsmMax: r.paperGsmMax,
          stockType: r.stockType,
          printType: r.printType,
          paperColor: r.paperColor,
          filmMaterialType: r.filmMaterialType,
          quantityMin: r.quantityMin,
          quantityMax: r.quantityMax,
          sheetWidthMinInches: r.sheetWidthMinInches,
          sheetWidthMaxInches: r.sheetWidthMaxInches,
          sheetLengthMinInches: r.sheetLengthMinInches,
          sheetLengthMaxInches: r.sheetLengthMaxInches,
          slowdownPercent: r.slowdownPercent,
        })),
      },
      {
        paperGsm,
        stockType,
        quantity: productionQty,
        linearFeet: primary.estimatedLinearFeet,
        printType: printTypeNorm,
        paperColor,
        sheetWidthInches: materialWidthInches,
        sheetLengthInches,
        filmMaterialType: roll.materialType,
      },
      { passCount, linearFeetOnePass: primary.estimatedLinearFeet },
    );
    if (Number.isFinite(br.totalMinutes)) {
      estimatedRunTimeMinutes = br.totalMinutes;
    }
    if (Number.isFinite(br.effectiveMpm) && br.effectiveMpm > 0) {
      effectiveLineSpeedMpm = br.effectiveMpm;
    }
    if (
      Number.isFinite(br.totalMinutes) &&
      Number.isFinite(br.runMinutes) &&
      Number.isFinite(br.setupMinutes)
    ) {
      const conv = estimateConversionFromRunBreakdown(br.runMinutes, br.setupMinutes, {
        hourlyRate: machine.hourlyRate,
        laborHourlyRate: machine.laborHourlyRate,
      });
      estimatedMachineCost = conv.machine;
      estimatedLaborCost = conv.labor;
    }
  }

  const totalCost =
    agg.totalCostFromFilm +
    (estimatedMachineCost ?? 0) +
    (estimatedLaborCost ?? 0) +
    (estimatedCutterCost ?? 0) +
    (estimatedSkidPackCost ?? 0) +
    (finalDeliveryCostUsd ?? 0);

  const creditCap = crmContact.company.creditLimit;
  const accountingReviewRequired =
    creditCap != null &&
    creditCap > 0 &&
    Number.isFinite(totalCost) &&
    totalCost > creditCap;

  const allocatedLines = allocateCostsToLines(orderLines, totalCost);

  let filmTypeStr: string;
  if (roll) {
    const filmTypeStrPrimary = await filmTypeLabel(roll);
    filmTypeStr = filmTypeStrPrimary;
    if (secondPassEnabled && !secondFilmSameAsFirst && secondRoll) {
      const secondLabel = await filmTypeLabel(secondRoll);
      filmTypeStr = `Pass 1: ${filmTypeStrPrimary} | Pass 2: ${secondLabel}`;
    } else if (secondPassEnabled) {
      filmTypeStr = `${filmTypeStrPrimary} (two passes, same film)`;
    }
  } else {
    filmTypeStr = "No lamination (paper-only quote)";
  }

  let sheetSize: string;
  if (laminationRequired) {
    sheetSize = `${materialWidthInches} × ${sheetLengthInches} in sheet (${primary.laminateWidthInches} in laminate width)`;
  } else {
    sheetSize = `${materialWidthInches} × ${sheetLengthInches} in sheet (no lamination)`;
  }
  if (finalW != null && finalL != null) {
    sheetSize += ` → final ${finalW} × ${finalL} in`;
  }

  const spoilageSheets = productionQty - quantity;
  const createData: Prisma.EstimateUncheckedCreateInput = {
    sheetSize,
    quantity,
    filmType: filmTypeStr,
      markup: 0,
      setupWaste: 0,
      totalCost,
      sheetLengthInches,
      estimatedLinearFeet: primary.estimatedLinearFeet,
      materialWidthInches,
      laminateWidthInches: primary.laminateWidthInches,
      laminateWidthInsetInches,
      rollWidthSnapshotInches: roll?.rollWidth ?? null,
      slitExcessWidthInches: primary.slitExcessWidthInches,
      materialSquareInches: agg.totalMaterialSquareInches,
      laminateFilmSquareInches: agg.totalLaminateFilmSquareInches,
      filmFromRollSquareInches: agg.totalFilmFromRollSquareInches,
      slitWasteSquareInches: agg.totalSlitWasteSquareInches,
      pricePerFilmSquareInch: laminationRequired ? pricePerFilmSquareInch : null,
      filmInventoryId: laminationRequired ? filmInventoryId : null,
      machineId,
      paperGsm,
      stockType,
      printType: printTypeNorm,
      paperColor,
      paperDescription,
      estimatedRunTimeMinutes,
      effectiveLineSpeedMpm,
      estimatedMachineCost,
      estimatedLaborCost,
      secondPassEnabled,
      secondFilmInventoryId:
        secondPassEnabled && !secondFilmSameAsFirst && secondRoll ? secondRoll.id : null,
      secondFilmSameAsFirst: secondPassEnabled ? secondFilmSameAsFirst : true,
      secondPricePerFilmSquareInch:
        secondPassEnabled && !secondFilmSameAsFirst && secondRoll
          ? secondRoll.pricePerFilmSquareInch
          : null,
      passCount,
      spoilageAllowanceSheets: spoilageSheets > 0 ? spoilageSheets : 0,
      finalSheetWidthInches: finalW,
      finalSheetLengthInches: finalL,
      finalTrimPiecesPerSheet,
      finalTrimNoBleedDutchCut,
      finalTrimImpositionRotated,
      finalTrimIsPressReady,
      estimatedFinishedPieceCount,
      sheetThicknessInches,
      cutterMachineId,
      estimatedCutCount,
      estimatedCutterSheetsPerLift,
      estimatedCutterLiftCount,
      estimatedCutterLaborHours,
      estimatedCutterMachineOnlyCost,
      estimatedCutterLaborOnlyCost,
      estimatedCutterCost,
      includesFinalDelivery,
      finalDeliveryCostUsd,
      finalDeliveryNotes,
      skidPackEnabled,
      estimatedSkidPackInboundSkids,
      estimatedSkidPackOutboundSkids,
      estimatedSkidPackCost,
      skidPackPricePerSkidSnapshot,
      companyId,
      contactId,
      quoteCompanyName: crmContact.company.name,
      quoteCompanyAddress: crmContact.company.address,
      quoteContactName: `${crmContact.firstName} ${crmContact.lastName}`.trim(),
      quoteContactEmail: crmContact.email,
      accountingReviewRequired,
      lines: {
        create: allocatedLines.map((l, i) => ({
          sortOrder: i,
          label: l.label,
          quantity: l.quantity,
          allocatedCostUsd: l.allocatedCostUsd,
        })),
      },
    };

    return {
      ok: true as const,
      createData,
      totalCost,
      accountingReviewRequired,
      companyId,
      contactId,
      machineId,
      crmContact,
      primary,
      agg: {
        totalMaterialSquareInches: agg.totalMaterialSquareInches,
        totalFilmFromRollSquareInches: agg.totalFilmFromRollSquareInches,
        totalCostFromFilm: agg.totalCostFromFilm,
      },
      estimatedMachineCost,
      estimatedLaborCost,
      estimatedCutCount,
      estimatedCutterSheetsPerLift,
      estimatedCutterLiftCount,
      estimatedCutterLaborHours,
      estimatedCutterMachineOnlyCost,
      estimatedCutterLaborOnlyCost,
      estimatedCutterCost,
      estimatedSkidPackCost,
      estimatedSkidPackInboundSkids,
      estimatedSkidPackOutboundSkids,
      skidPackPricePerSkidSnapshot,
    };
  } catch (e) {
    if (e instanceof HttpError) {
      return { ok: false, status: e.status, error: e.message };
    }
    throw e;
  }
}
