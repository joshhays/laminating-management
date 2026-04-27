/**
 * What-if totals for alternate order sheet quantities (same run setup as the live estimate).
 */

import type { EstimatePaperColor } from "@prisma/client";
import type { AggregatedFilmEstimate } from "@/lib/estimate-film-aggregate";
import { aggregateFilmForEstimate } from "@/lib/estimate-film-aggregate";
import { estimateConversionFromRunBreakdown } from "@/lib/job-conversion-costs";
import type { CutterLaborTimeFields } from "@/lib/cutter-labor-cost";
import { cutterLiftPlan } from "@/lib/cutter-lift-plan";
import { estimateCutterLaborAndCost } from "@/lib/cutter-estimate";
import { resolveCutterOversizeForEstimate } from "@/lib/cutter-oversize";
import { totalCutterStrokes } from "@/lib/cutter-trim";
import type { MachineWithReductionRulesInput } from "@/lib/machine-run-time";
import {
  estimateTotalRunTimeFromMachine,
  type JobRequirementsForRunTime,
  type RunTimeBreakdownWithSource,
} from "@/lib/machine-run-time";
import { productionSheetCount } from "@/lib/spoilage";
import { spoilagePercentForQuantity } from "@/lib/spoilage-rules";
import { estimateSkidPack } from "@/lib/skid-pack-estimate";

export const MAX_COMPARE_SHEET_QTY_SCENARIOS = 8;

export function parseCompareSheetQuantities(input: string): number[] {
  const parts = input
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const nums = parts
    .map((p) => Math.floor(Number(p)))
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(nums)].sort((a, b) => a - b).slice(0, MAX_COMPARE_SHEET_QTY_SCENARIOS);
}

export type SpoilageRuleInput = {
  sortOrder: number;
  quantityMin: number | null;
  quantityMax: number | null;
  spoilagePercent: number;
  paperBasis: "TEXT" | "COVER" | null;
};

export type ScenarioGrandTotalInput = {
  orderSheetQty: number;
  laminationRequired: boolean;
  secondPassEnabled: boolean;
  secondFilmSameAsFirst: boolean;
  sheetLenNum: number;
  matWNum: number;
  laminateWidthInsetInches: number;
  firstRoll: {
    rollWidth: number;
    pricePerFilmSquareInch: number;
    materialType: string;
    thicknessMil: number;
  } | null;
  secondRoll: { rollWidth: number; pricePerFilmSquareInch: number; thicknessMil: number } | null;
  machineForRunTime: MachineWithReductionRulesInput | null;
  machineHourlyRate: number;
  machineLaborHourlyRate: number;
  effectiveGsm: number;
  effectiveStockType: string;
  printProcess: "Offset" | "Digital";
  paperColor: EstimatePaperColor;
  spoilageRules: SpoilageRuleInput[];
  spoilageFallback: number;
  spoilagePaperBasisForJob: "text" | "cover" | null;
  skidPackEnabled: boolean;
  skidShippingSettings: {
    pricePerSkidUsd: number;
    maxStackHeightInches: number;
    maxSkidWeightLbs: number;
  };
  /** Same resolution as skid preview: final trim if set, else parent sheet size. */
  skidFinishedWidthInches: number;
  skidFinishedLengthInches: number;
  skidSubstrateThicknessInches: number | null;
  piecesPerSheetNum: number;
  laminationFilmMil: number;
  secondFilmMil: number | null;
  paperGsmForSkid: number | null;
  trimRequiresCutter: boolean;
  cutterBaseCuts: number;
  cutterProfile: CutterLaborTimeFields;
  cutterHourlyRate: number;
  cutterLaborHourlyRate: number;
  cutterHelperLaborHourlyRate: number | null;
  cutterMaxHeightInches: number | null;
  cutterOversizeMinLongEdgeInches: number | null;
  cutterOversizeMaxLiftHeightInches: number | null;
  substrateThicknessForCutter: number | null;
  finalWForCutter: number;
  finalLForCutter: number;
  includesFinalDelivery: boolean;
  finalDeliveryUsd: number;
};

export type ScenarioGrandTotalResult = {
  totalUsd: number | null;
  productionSheets: number;
  error: string | null;
};

export type ScenarioCutterLaborPreview = {
  hours: number;
  totalUsd: number;
  machineUsd: number;
  laborUsd: number;
  totalCuts: number;
  numLifts: number;
  sheetsPerLift: number;
  error: string | null;
  oversize: boolean;
  liftCappedForOversize: boolean;
  usingHelperLaborRate: boolean;
  effectiveLaborHourlyRate: number;
  effectiveLiftMaxHeightInches: number | null;
};

export type ScenarioSkidPackPreview = {
  inboundSkids: number;
  outboundSkids: number;
  costUsd: number;
  sheetsPerSkidInbound: number;
  sheetsPerSkidOutbound: number;
  laminatedThicknessInches: number;
  substrateThicknessInches: number;
  filmAddedThicknessInches: number;
  error: string | null;
};

export type ScenarioFullPreviewResult = {
  orderSheetQty: number;
  spoilagePct: number;
  productionQty: number;
  filmAgg: AggregatedFilmEstimate | null;
  runBreakdown: RunTimeBreakdownWithSource | null;
  estimateConversionUsd: { machine: number; labor: number } | null;
  previewCutterLabor: ScenarioCutterLaborPreview;
  previewSkidPack: ScenarioSkidPackPreview;
  previewGrandTotalUsd: number | null;
  error: string | null;
};

function emptyScenarioCutter(): ScenarioCutterLaborPreview {
  return {
    hours: 0,
    totalUsd: 0,
    machineUsd: 0,
    laborUsd: 0,
    totalCuts: 0,
    numLifts: 0,
    sheetsPerLift: 0,
    error: null,
    oversize: false,
    liftCappedForOversize: false,
    usingHelperLaborRate: false,
    effectiveLaborHourlyRate: 0,
    effectiveLiftMaxHeightInches: null,
  };
}

function emptyScenarioSkid(): ScenarioSkidPackPreview {
  return {
    inboundSkids: 0,
    outboundSkids: 0,
    costUsd: 0,
    sheetsPerSkidInbound: 0,
    sheetsPerSkidOutbound: 0,
    laminatedThicknessInches: 0,
    substrateThicknessInches: 0,
    filmAddedThicknessInches: 0,
    error: null,
  };
}

/** Full film / time / cost breakdown for an alternate order sheet quantity (same inputs as the live estimate). */
export function computeScenarioFullPreview(p: ScenarioGrandTotalInput): ScenarioFullPreviewResult {
  const emptyCutter = emptyScenarioCutter();
  const emptySkid = emptyScenarioSkid();

  const q = Math.floor(p.orderSheetQty);
  if (!Number.isInteger(q) || q <= 0) {
    return {
      orderSheetQty: q,
      spoilagePct: 0,
      productionQty: 0,
      filmAgg: null,
      runBreakdown: null,
      estimateConversionUsd: null,
      previewCutterLabor: emptyCutter,
      previewSkidPack: emptySkid,
      previewGrandTotalUsd: null,
      error: null,
    };
  }

  const spoilagePct = p.laminationRequired
    ? spoilagePercentForQuantity(
        q,
        p.spoilageRules.map((r) => ({
          sortOrder: r.sortOrder,
          quantityMin: r.quantityMin,
          quantityMax: r.quantityMax,
          spoilagePercent: r.spoilagePercent,
          paperBasis: r.paperBasis,
        })),
        p.spoilageFallback,
        { paperBasis: p.spoilagePaperBasisForJob, secondPass: p.secondPassEnabled },
      )
    : 0;

  const productionQty = productionSheetCount(q, spoilagePct);

  let filmAgg: AggregatedFilmEstimate | null = null;
  let linearFeetOnePass = (productionQty * p.sheetLenNum) / 12;

  if (p.laminationRequired && p.firstRoll) {
    try {
      filmAgg = aggregateFilmForEstimate({
        productionQuantity: productionQty,
        sheetLengthInches: p.sheetLenNum,
        materialWidthInches: p.matWNum,
        firstRoll: {
          rollWidth: p.firstRoll.rollWidth,
          pricePerFilmSquareInch: p.firstRoll.pricePerFilmSquareInch,
        },
        secondPassEnabled: p.secondPassEnabled,
        secondFilmSameAsFirst: p.secondFilmSameAsFirst,
        secondRoll:
          p.secondPassEnabled && !p.secondFilmSameAsFirst && p.secondRoll
            ? {
                rollWidth: p.secondRoll.rollWidth,
                pricePerFilmSquareInch: p.secondRoll.pricePerFilmSquareInch,
              }
            : null,
        laminateWidthInsetInches: p.laminateWidthInsetInches,
      });
      linearFeetOnePass = filmAgg.primary.estimatedLinearFeet;
    } catch (e) {
      return {
        orderSheetQty: q,
        spoilagePct,
        productionQty,
        filmAgg: null,
        runBreakdown: null,
        estimateConversionUsd: null,
        previewCutterLabor: emptyCutter,
        previewSkidPack: emptySkid,
        previewGrandTotalUsd: null,
        error: e instanceof Error ? e.message : "Film / dimensions",
      };
    }
  }

  let runBreakdown: RunTimeBreakdownWithSource | null = null;
  let estimateConversionUsd: { machine: number; labor: number } | null = null;
  if (p.laminationRequired && p.machineForRunTime && p.firstRoll) {
    const passCount: 1 | 2 = p.secondPassEnabled ? 2 : 1;
    const jobReq: JobRequirementsForRunTime = {
      paperGsm: p.effectiveGsm,
      stockType: p.effectiveStockType,
      quantity: productionQty,
      linearFeet: linearFeetOnePass,
      printType: p.printProcess,
      paperColor: p.paperColor,
      sheetWidthInches: p.matWNum,
      sheetLengthInches: p.sheetLenNum,
      filmMaterialType: p.firstRoll.materialType,
    };
    const br = estimateTotalRunTimeFromMachine(p.machineForRunTime, jobReq, {
      passCount,
      linearFeetOnePass,
    });
    runBreakdown = br;
    if (
      Number.isFinite(br.totalMinutes) &&
      Number.isFinite(br.runMinutes) &&
      Number.isFinite(br.setupMinutes)
    ) {
      estimateConversionUsd = estimateConversionFromRunBreakdown(br.runMinutes, br.setupMinutes, {
        hourlyRate: p.machineHourlyRate,
        laborHourlyRate: p.machineLaborHourlyRate,
      });
    }
  }

  let previewSkidPack = emptySkid;
  if (
    p.skidPackEnabled &&
    p.skidSubstrateThicknessInches != null &&
    p.skidSubstrateThicknessInches > 0 &&
    Number.isFinite(p.skidFinishedWidthInches) &&
    Number.isFinite(p.skidFinishedLengthInches) &&
    p.skidFinishedWidthInches > 0 &&
    p.skidFinishedLengthInches > 0
  ) {
    const skid = estimateSkidPack({
      productionSheetCount: productionQty,
      finalTrimPiecesPerSheet: Math.max(1, p.piecesPerSheetNum),
      parentWidthInches: p.matWNum,
      parentLengthInches: p.sheetLenNum,
      finishedWidthInches: p.skidFinishedWidthInches,
      finishedLengthInches: p.skidFinishedLengthInches,
      substrateThicknessInches: p.skidSubstrateThicknessInches,
      primaryFilmThicknessMil: p.laminationRequired ? p.laminationFilmMil : 0,
      secondPassEnabled: p.laminationRequired ? p.secondPassEnabled : false,
      secondFilmSameAsFirst: p.laminationRequired ? p.secondFilmSameAsFirst : true,
      secondFilmThicknessMil: p.secondFilmMil,
      pricePerSkidUsd: p.skidShippingSettings.pricePerSkidUsd,
      maxStackHeightInches: p.skidShippingSettings.maxStackHeightInches,
      maxSkidWeightLbs: p.skidShippingSettings.maxSkidWeightLbs,
      paperGsm: p.paperGsmForSkid,
    });
    if (skid) {
      previewSkidPack = {
        inboundSkids: skid.inboundSkids,
        outboundSkids: skid.outboundSkids,
        costUsd: skid.costUsd,
        sheetsPerSkidInbound: skid.sheetsPerSkidInbound,
        sheetsPerSkidOutbound: skid.sheetsPerSkidOutbound,
        laminatedThicknessInches: skid.laminatedThicknessInches,
        substrateThicknessInches: p.skidSubstrateThicknessInches,
        filmAddedThicknessInches: skid.filmAddedThicknessInches,
        error: null,
      };
    } else {
      previewSkidPack = {
        ...emptySkid,
        error:
          "Skid pack could not fit finished size on parent sheet footprint, or caliper/film data is invalid.",
      };
    }
  }

  let previewCutterLabor = emptyCutter;
  if (
    p.trimRequiresCutter &&
    p.cutterBaseCuts > 0 &&
    p.substrateThicknessForCutter != null &&
    p.substrateThicknessForCutter > 0 &&
    Number.isFinite(p.finalWForCutter) &&
    Number.isFinite(p.finalLForCutter) &&
    p.finalWForCutter > 0 &&
    p.finalLForCutter > 0
  ) {
    const oversizeRes = resolveCutterOversizeForEstimate({
      sheetWidthInches: p.finalWForCutter,
      sheetLengthInches: p.finalLForCutter,
      cutterMaxHeightInches: p.cutterMaxHeightInches,
      cutterOversizeMinLongEdgeInches: p.cutterOversizeMinLongEdgeInches,
      cutterOversizeMaxLiftHeightInches: p.cutterOversizeMaxLiftHeightInches,
      laborHourlyRate: p.cutterLaborHourlyRate,
      cutterHelperLaborHourlyRate: p.cutterHelperLaborHourlyRate,
    });
    const liftPlan = cutterLiftPlan(
      productionQty,
      p.substrateThicknessForCutter,
      oversizeRes.effectiveLiftMaxHeightInches,
    );
    if (!liftPlan.ok) {
      previewCutterLabor = { ...emptyCutter, error: liftPlan.error };
    } else {
      const totalCuts = totalCutterStrokes(p.cutterBaseCuts, liftPlan.numLifts);
      const labor = estimateCutterLaborAndCost(
        totalCuts,
        productionQty,
        p.substrateThicknessForCutter,
        oversizeRes.effectiveLiftMaxHeightInches,
        p.cutterProfile,
        p.cutterHourlyRate,
        oversizeRes.effectiveLaborHourlyRate,
      );
      if (!labor.ok) {
        previewCutterLabor = { ...emptyCutter, error: labor.error };
      } else {
        previewCutterLabor = {
          hours: labor.hours,
          totalUsd: labor.cost.total,
          machineUsd: labor.cost.machine,
          laborUsd: labor.cost.labor,
          totalCuts,
          numLifts: labor.numLifts,
          sheetsPerLift: labor.sheetsPerLift,
          error: null,
          oversize: oversizeRes.oversize,
          liftCappedForOversize: oversizeRes.liftCappedForOversize,
          usingHelperLaborRate: oversizeRes.usingHelperLaborRate,
          effectiveLaborHourlyRate: oversizeRes.effectiveLaborHourlyRate,
          effectiveLiftMaxHeightInches: oversizeRes.effectiveLiftMaxHeightInches,
        };
      }
    }
  }

  const filmUsd = filmAgg?.totalCostFromFilm ?? 0;
  const convMachine = estimateConversionUsd?.machine ?? 0;
  const convLabor = estimateConversionUsd?.labor ?? 0;
  const skidUsd = previewSkidPack.error ? 0 : previewSkidPack.costUsd;
  const cutterUsd = previewCutterLabor.error ? 0 : previewCutterLabor.totalUsd;
  const deliveryUsd = p.includesFinalDelivery ? Math.max(0, p.finalDeliveryUsd) : 0;

  const totalUsd = filmUsd + convMachine + convLabor + skidUsd + cutterUsd + deliveryUsd;

  return {
    orderSheetQty: q,
    spoilagePct,
    productionQty,
    filmAgg,
    runBreakdown,
    estimateConversionUsd,
    previewCutterLabor,
    previewSkidPack,
    previewGrandTotalUsd: Number.isFinite(totalUsd) ? totalUsd : null,
    error: null,
  };
}

export function computeScenarioGrandTotalUsd(p: ScenarioGrandTotalInput): ScenarioGrandTotalResult {
  const full = computeScenarioFullPreview(p);
  if (full.error) {
    return { totalUsd: null, productionSheets: full.productionQty, error: full.error };
  }
  return {
    totalUsd: full.previewGrandTotalUsd,
    productionSheets: full.productionQty,
    error: null,
  };
}
