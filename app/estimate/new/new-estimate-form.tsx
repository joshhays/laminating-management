"use client";

import Link from "next/link";
import type { MachineTypeKind } from "@prisma/client";
import { EstimatePaperColor } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { estimateCutterLaborAndCost } from "@/lib/cutter-estimate";
import { resolveCutterOversizeForEstimate } from "@/lib/cutter-oversize";
import { cutterLiftPlan } from "@/lib/cutter-lift-plan";
import {
  computeCutterBaseCutsFromTrim,
  finishedPieceCount,
  parentFinalDimensionsDifferForCutter,
  totalCutterStrokes,
} from "@/lib/cutter-trim";
import { calculateTrimImpositionBest, calculateYield } from "@/lib/print-cuts";
import { aggregateFilmForEstimate } from "@/lib/estimate-film-aggregate";
import {
  estimateSkidPack,
  LAMINATED_SHEET_WEIGHT_FACTOR,
} from "@/lib/skid-pack-estimate";
import {
  LAMINATE_INSET_PER_SIDE_INCHES,
  LAMINATE_WIDTH_INSET_INCHES,
  MIN_SLIT_STRIP_WIDTH_INCHES,
  SQUARE_INCHES_PER_MSI,
} from "@/lib/estimate-math";
import { BUNDLE_PART_LABEL_MAX, MAX_BUNDLE_PARTS } from "@/lib/estimate-bundle";
import { MAX_ESTIMATE_LINES } from "@/lib/estimate-lines";
import {
  createEmptyPartDraft,
  effectiveGsmFromDraft,
  paperDescriptionComposedFromDraft,
  partDraftToEstimatePostFields,
  qtyTotalFromOrderLines,
  type NewEstimatePartDraft,
} from "@/lib/new-estimate-part-draft";
import { estimateConversionFromRunBreakdown } from "@/lib/job-conversion-costs";
import { validateSheetAgainstMachineBounds } from "@/lib/machine-sheet-bounds";
import { estimateTotalRunTimeFromMachine } from "@/lib/machine-run-time";
import {
  computeScenarioFullPreview,
  computeScenarioGrandTotalUsd,
  MAX_COMPARE_SHEET_QTY_SCENARIOS,
  parseCompareSheetQuantities,
  type ScenarioGrandTotalInput,
} from "@/lib/estimate-scenario-total";
import { spoilagePercentForQuantity } from "@/lib/spoilage-rules";
import { productionSheetCount } from "@/lib/spoilage";
import { resolveCutterSheetThicknessInches } from "@/lib/cutter-sheet-thickness";
import {
  formatSheetThicknessInchesLikePaperRef,
  gsmFromPaperCaliperPt,
  GSM_PER_CALIPER_PT,
  type PaperRefRow,
} from "@/lib/paper-ref";
import {
  basisKindFromEstimatePaperGrade,
  composePaperDescriptionFromFields,
  parsePaperSpecificationToGsm,
  sheetWeightFromGsm,
  tryExtractStructuredPaperFromSpec,
  usBasisLbToGsm,
  type PaperSurfaceFinish,
} from "@/lib/paper-spec-to-gsm";
import { formatSheetsPerHour, sheetsPerHourFromMpm } from "@/lib/sheets-per-hour";
import {
  isLaminatorForEstimates,
  usesCutterEstimateFields,
} from "@/lib/machine-equipment-profile";
import { FilmRollPicker } from "@/components/estimate/film-roll-picker";
import type { FilmOption } from "@/lib/estimate-film-option";
import { ESTIMATE_PAPER_COLOR_OPTIONS } from "@/lib/estimate-paper-color";
import { ESTIMATE_STOCK_TYPE_OPTIONS } from "@/lib/stock-type-options";
import type { CrmEstimateContext } from "@/lib/crm-estimate-context";
import type { EstimateFormPrefill, EstimateFormWorkflowBanner } from "@/lib/estimate-workflow";

function thicknessResolveUsesPaperRef(
  source: "paper_ref" | "paper_ref_pt" | "manual",
): boolean {
  return source === "paper_ref" || source === "paper_ref_pt";
}

export type { FilmOption } from "@/lib/estimate-film-option";

export type MachineOption = {
  id: string;
  name: string;
  maxWidthInches: number;
  maxSpeedMetersMin: number;
  maxTotalSlowdownPercent: number;
  hourlyRate: number;
  laborHourlyRate: number;
  makeReadyMinutes: number;
  extraMakeReadyDigitalMinutes: number;
  extraMakeReadyOffsetMinutes: number;
  sideChangeMinutes: number;
  washUpMinutes: number;
  spoilagePercent: number;
  spoilageRules: Array<{
    sortOrder: number;
    quantityMin: number | null;
    quantityMax: number | null;
    spoilagePercent: number;
    paperBasis: "TEXT" | "COVER" | null;
  }>;
  minSheetWidthInches: number | null;
  maxSheetWidthInches: number | null;
  minSheetLengthInches: number | null;
  maxSheetLengthInches: number | null;
  speedReductionRules: Array<{
    sortOrder: number;
    name: string | null;
    paperGsmMin: number | null;
    paperGsmMax: number | null;
    stockType: string | null;
    printType: string | null;
    filmMaterialType: string | null;
    quantityMin: number | null;
    quantityMax: number | null;
    sheetWidthMinInches: number | null;
    sheetWidthMaxInches: number | null;
    sheetLengthMinInches: number | null;
    sheetLengthMaxInches: number | null;
    paperColor: EstimatePaperColor | null;
    slowdownPercent: number;
  }>;
  machineType: {
    kind: MachineTypeKind;
    finishingKind?: string | null;
    pressTechnology?: string | null;
  } | null;
  pricePerCut: number;
  cutterBaseSetupHours: number;
  cutterBuildLiftHours: number;
  cutterAdditionalSetupHoursPerCut: number;
  cutterPerCutHours: number;
  cutterMaxHeightInches: number | null;
  cutterOversizeMinLongEdgeInches: number | null;
  cutterOversizeMaxLiftHeightInches: number | null;
  cutterHelperLaborHourlyRate: number | null;
};

function fmtNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes === Number.POSITIVE_INFINITY) {
    return "— (line speed is zero)";
  }
  if (minutes < 90) {
    return `${minutes.toFixed(1)} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return `${h}h ${m}m (~${Math.round(minutes)} min)`;
}

function fmtUsd(n: number, digits = 2) {
  return `$${fmtNum(n, digits)}`;
}

function LiveEstimateSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <tbody>
      <tr className="bg-zinc-100">
        <th
          colSpan={3}
          scope="colgroup"
          className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
        >
          {title}
        </th>
      </tr>
      {children}
    </tbody>
  );
}

function LiveEstimateRow({
  item,
  basis,
  value,
}: {
  item: React.ReactNode;
  basis: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <tr className="border-b border-zinc-100 align-top">
      <td className="px-3 py-2 text-sm text-zinc-900">{item}</td>
      <td className="px-3 py-2 text-xs leading-snug text-zinc-600">{basis}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-zinc-800">{value}</td>
    </tr>
  );
}

export function NewEstimateForm({
  films,
  machines,
  paperRefRows,
  skidShippingSettings,
  crmContext,
  workflowBanner,
  prefill,
}: {
  films: FilmOption[];
  machines: MachineOption[];
  paperRefRows: PaperRefRow[];
  skidShippingSettings: {
    pricePerSkidUsd: number;
    maxStackHeightInches: number;
    maxSkidWeightLbs: number;
  };
  crmContext: CrmEstimateContext | null;
  workflowBanner?: EstimateFormWorkflowBanner;
  prefill?: EstimateFormPrefill | null;
}) {
  const router = useRouter();
  const [filmsList, setFilmsList] = useState<FilmOption[]>(films);

  useEffect(() => {
    setFilmsList((prev) => {
      const serverIds = new Set(films.map((f) => f.id));
      const extras = prev.filter((p) => !serverIds.has(p.id));
      return [...extras, ...films];
    });
  }, [films]);
  const laminatorMachines = useMemo(
    () => machines.filter((m) => isLaminatorForEstimates(m.machineType)),
    [machines],
  );
  const cutterMachines = useMemo(
    () =>
      machines
        .filter((m) => m.machineType != null && usesCutterEstimateFields(m.machineType))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [machines],
  );

  const lineIdRef = useRef(1);
  const mkLine = () => {
    lineIdRef.current += 1;
    return { id: `ln-${lineIdRef.current}`, label: "", quantity: "" };
  };

  const [partDrafts, setPartDrafts] = useState<NewEstimatePartDraft[]>(() => [
    createEmptyPartDraft(films, laminatorMachines, "ln-1"),
  ]);
  const [activePartIdx, setActivePartIdx] = useState(0);

  const tab = partDrafts[activePartIdx]!;

  function mkSetter<K extends keyof NewEstimatePartDraft>(key: K) {
    return (v: React.SetStateAction<NewEstimatePartDraft[K]>) => {
      setPartDrafts((rows) => {
        const cur = rows[activePartIdx];
        if (!cur) return rows;
        const prev = cur[key];
        const next =
          typeof v === "function"
            ? (v as (x: NewEstimatePartDraft[K]) => NewEstimatePartDraft[K])(prev)
            : v;
        return rows.map((r, i) => (i === activePartIdx ? { ...r, [key]: next } : r));
      });
    };
  }

  const setFilmId = mkSetter("filmId");
  const setMachineId = mkSetter("machineId");
  const setSkidPackEnabled = mkSetter("skidPackEnabled");
  const setPrintProcess = mkSetter("printProcess");
  const setPaperColor = mkSetter("paperColor");
  const setPaperBasisLb = mkSetter("paperBasisLb");
  const setPaperBasisKind = mkSetter("paperBasisKind");
  const setPaperFinish = mkSetter("paperFinish");
  const setPaperNotes = mkSetter("paperNotes");
  const setPaperGsm = mkSetter("paperGsm");
  const setPaperGsmUserEdited = mkSetter("paperGsmUserEdited");
  const setPaperCaliperPt = mkSetter("paperCaliperPt");
  const setStockType = mkSetter("stockType");
  const setCustomStockType = mkSetter("customStockType");
  const setSheetLengthInches = mkSetter("sheetLengthInches");
  const setOrderLines = mkSetter("orderLines");
  const setCompareSheetQtyInput = mkSetter("compareSheetQtyInput");
  const setMaterialWidthInches = mkSetter("materialWidthInches");
  const setLaminateWidthInsetInches = mkSetter("laminateWidthInsetInches");
  const setSecondPassEnabled = mkSetter("secondPassEnabled");
  const setSecondFilmSameAsFirst = mkSetter("secondFilmSameAsFirst");
  const setSecondFilmId = mkSetter("secondFilmId");
  const setFinalSheetWidthInches = mkSetter("finalSheetWidthInches");
  const setFinalSheetLengthInches = mkSetter("finalSheetLengthInches");
  const setFinalTrimNoBleedDutchCut = mkSetter("finalTrimNoBleedDutchCut");
  const setIsPressReady = mkSetter("isPressReady");
  const setIncludesFinalDelivery = mkSetter("includesFinalDelivery");
  const setFinalDeliveryCostInput = mkSetter("finalDeliveryCostInput");
  const setFinalDeliveryNotes = mkSetter("finalDeliveryNotes");
  const setSheetThicknessInches = mkSetter("sheetThicknessInches");
  const setPartLabel = mkSetter("partLabel");
  const setLaminationRequired = mkSetter("laminationRequired");

  const {
    laminationRequired,
    filmId,
    machineId,
    skidPackEnabled,
    printProcess,
    paperColor,
    paperBasisLb,
    paperBasisKind,
    paperFinish,
    paperNotes,
    paperGsm,
    paperGsmUserEdited,
    paperCaliperPt,
    stockType,
    customStockType,
    sheetLengthInches,
    orderLines,
    compareSheetQtyInput,
    materialWidthInches,
    laminateWidthInsetInches,
    secondPassEnabled,
    secondFilmSameAsFirst,
    secondFilmId,
    finalSheetWidthInches,
    finalSheetLengthInches,
    finalTrimNoBleedDutchCut,
    isPressReady,
    includesFinalDelivery,
    finalDeliveryCostInput,
    finalDeliveryNotes,
    sheetThicknessInches,
    partLabel,
  } = tab;

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const prefillAppliedRef = useRef(false);
  const [activeStep, setActiveStep] = useState(0);

  function addBundlePartTab() {
    let newIndex: number | null = null;
    setPartDrafts((rows) => {
      if (rows.length >= MAX_BUNDLE_PARTS) return rows;
      lineIdRef.current += 1;
      const next = [
        ...rows,
        createEmptyPartDraft(filmsList, laminatorMachines, `ln-${lineIdRef.current}`),
      ];
      newIndex = next.length - 1;
      return next;
    });
    if (newIndex != null) setActivePartIdx(newIndex);
  }

  function removeBundlePartTab(index: number) {
    setPartDrafts((rows) => {
      if (rows.length <= 1) return rows;
      return rows.filter((_, i) => i !== index);
    });
    setActivePartIdx((cur) => {
      if (cur === index) return Math.max(0, index - 1);
      if (cur > index) return cur - 1;
      return cur;
    });
  }

  const sheetLenNum = Number(sheetLengthInches);
  const qtyReadyAndTotal = useMemo(() => {
    if (orderLines.length === 0) return { ok: false as const, total: 0 };
    let total = 0;
    for (const row of orderLines) {
      if (row.label.trim() === "") return { ok: false as const, total: 0 };
      const t = row.quantity.trim();
      if (t === "") return { ok: false as const, total: 0 };
      const q = Math.floor(Number(t));
      if (!Number.isInteger(q) || q <= 0) return { ok: false as const, total: 0 };
      total += q;
    }
    return { ok: true as const, total };
  }, [orderLines]);
  const qtyReady = qtyReadyAndTotal.ok;

  const descriptionStepValid = useMemo(
    () => orderLines.length > 0 && orderLines.every((r) => r.label.trim() !== ""),
    [orderLines],
  );

  const qtyNumbersOk = useMemo(() => {
    if (orderLines.length === 0) return false;
    for (const row of orderLines) {
      const t = row.quantity.trim();
      if (t === "") return false;
      const q = Math.floor(Number(t));
      if (!Number.isInteger(q) || q <= 0) return false;
    }
    return true;
  }, [orderLines]);
  const qtyNum = qtyReady ? qtyReadyAndTotal.total : 0;
  const matWNum = Number(materialWidthInches);
  const gsmNum = Number(paperGsm);

  const laminateInsetForFilm = useMemo(() => {
    if (!laminationRequired) return LAMINATE_WIDTH_INSET_INCHES;
    const t = laminateWidthInsetInches.trim();
    const n = t === "" ? LAMINATE_WIDTH_INSET_INCHES : Number(t);
    if (!Number.isFinite(n) || n < 0.125 || n > 3) return LAMINATE_WIDTH_INSET_INCHES;
    if (!Number.isFinite(matWNum) || matWNum <= 0 || n >= matWNum - 1e-9) {
      return LAMINATE_WIDTH_INSET_INCHES;
    }
    return n;
  }, [laminationRequired, laminateWidthInsetInches, matWNum]);

  const effectiveStockType =
    stockType === "__custom__" ? customStockType.trim() : stockType;

  const basisKindHintForForm = useMemo(() => {
    if (paperBasisKind === "text" || paperBasisKind === "cover") {
      return paperBasisKind;
    }
    if (!stockType) return undefined;
    if (stockType === "__custom__") {
      return basisKindFromEstimatePaperGrade(customStockType) ?? undefined;
    }
    return basisKindFromEstimatePaperGrade(stockType) ?? undefined;
  }, [paperBasisKind, stockType, customStockType]);

  const paperDescriptionComposed = useMemo(() => {
    const lb = Number(paperBasisLb);
    const hasStruct =
      Number.isFinite(lb) &&
      lb > 0 &&
      lb <= 500 &&
      (paperBasisKind === "text" || paperBasisKind === "cover");
    if (hasStruct) {
      return composePaperDescriptionFromFields({
        basisLb: lb,
        basisKind: paperBasisKind,
        finish: paperFinish,
        extraNotes: paperNotes.trim() || undefined,
      });
    }
    return paperNotes.trim();
  }, [paperBasisLb, paperBasisKind, paperFinish, paperNotes]);

  const structuredBasisGsm = useMemo(() => {
    const lb = Number(paperBasisLb);
    if (!Number.isFinite(lb) || lb <= 0 || lb > 500) return null;
    if (paperBasisKind !== "text" && paperBasisKind !== "cover") return null;
    return usBasisLbToGsm(lb, paperBasisKind);
  }, [paperBasisLb, paperBasisKind]);

  const parsedPaperSpec = useMemo(
    () =>
      parsePaperSpecificationToGsm(
        paperDescriptionComposed,
        basisKindHintForForm ? { basisKindHint: basisKindHintForForm } : undefined,
      ),
    [paperDescriptionComposed, basisKindHintForForm],
  );
  const paperCaliperPtResolved = useMemo(() => {
    const t = paperCaliperPt.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [paperCaliperPt]);
  const hasStructuredPaperBasisLb = useMemo(() => {
    const lb = Number(paperBasisLb);
    return (
      Number.isFinite(lb) &&
      lb > 0 &&
      lb <= 500 &&
      (paperBasisKind === "text" || paperBasisKind === "cover")
    );
  }, [paperBasisLb, paperBasisKind]);
  const gsmFromCaliperPtRule = useMemo(() => {
    if (hasStructuredPaperBasisLb || paperCaliperPtResolved == null) return null;
    const g = gsmFromPaperCaliperPt(paperCaliperPtResolved);
    return Number.isFinite(g) && g > 0 ? g : null;
  }, [hasStructuredPaperBasisLb, paperCaliperPtResolved]);
  const effectiveGsm =
    Number.isFinite(gsmNum) && gsmNum > 0
      ? gsmNum
      : parsedPaperSpec.gsm != null && parsedPaperSpec.gsm > 0
        ? parsedPaperSpec.gsm
        : gsmFromCaliperPtRule != null
          ? gsmFromCaliperPtRule
          : NaN;

  const sheetWeightPreview = useMemo(() => {
    if (!Number.isFinite(effectiveGsm) || effectiveGsm <= 0) return null;
    return sheetWeightFromGsm(effectiveGsm, matWNum, sheetLenNum);
  }, [effectiveGsm, matWNum, sheetLenNum]);

  useEffect(() => {
    if (!laminationRequired) return;
    if (machineId && laminatorMachines.some((m) => m.id === machineId)) return;
    setMachineId(laminatorMachines[0]?.id ?? "");
  }, [laminationRequired, laminatorMachines, machineId]);

  useEffect(() => {
    if (!prefill || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    const p = prefill;
    setPartDrafts((rows) => {
      const d = { ...rows[0]! };
      if (p.materialWidthInches != null && Number.isFinite(p.materialWidthInches) && p.materialWidthInches > 0) {
        d.materialWidthInches = String(p.materialWidthInches);
      }
      if (Number.isFinite(p.sheetLengthInches) && p.sheetLengthInches > 0) {
        d.sheetLengthInches = String(p.sheetLengthInches);
      }
      const q = Math.floor(Number(p.quantity));
      if (Number.isFinite(q) && q > 0) {
        d.orderLines = [{ id: "ln-1", label: "", quantity: String(q) }];
        lineIdRef.current = 1;
      }
      if (p.paperDescription.trim()) {
        const extracted = tryExtractStructuredPaperFromSpec(p.paperDescription);
        if (extracted) {
          d.paperBasisLb = extracted.basisLb;
          d.paperBasisKind = extracted.basisKind;
          d.paperFinish = extracted.finish;
          d.paperNotes = extracted.extraNotes;
        } else {
          d.paperBasisLb = "";
          d.paperBasisKind = "";
          d.paperFinish = "coated";
          d.paperNotes = p.paperDescription.trim();
        }
        d.paperGsmUserEdited = false;
      }
      if (p.paperGsm != null && Number.isFinite(p.paperGsm) && p.paperGsm > 0) {
        d.paperGsm = String(p.paperGsm);
        d.paperGsmUserEdited = true;
      }
      const st = (p.stockType ?? "").trim();
      if (st) {
        const preset = ESTIMATE_STOCK_TYPE_OPTIONS.some((o) => o.value === st);
        if (preset) {
          d.stockType = st;
          d.customStockType = "";
        } else {
          d.stockType = "__custom__";
          d.customStockType = st;
        }
      }
      const pt = (p.printType ?? "").trim().toLowerCase();
      d.printProcess = pt === "digital" ? "Digital" : "Offset";
      d.paperColor = p.paperColor;
      if (p.finalSheetWidthInches != null && Number.isFinite(p.finalSheetWidthInches) && p.finalSheetWidthInches > 0) {
        d.finalSheetWidthInches = String(p.finalSheetWidthInches);
      }
      if (
        p.finalSheetLengthInches != null &&
        Number.isFinite(p.finalSheetLengthInches) &&
        p.finalSheetLengthInches > 0
      ) {
        d.finalSheetLengthInches = String(p.finalSheetLengthInches);
      }
      if (p.sheetThicknessInches != null && Number.isFinite(p.sheetThicknessInches) && p.sheetThicknessInches > 0) {
        d.sheetThicknessInches = String(p.sheetThicknessInches);
      }
      if (p.finalTrimIsPressReady === true) {
        d.isPressReady = true;
      }
      if (
        p.laminateWidthInsetInches != null &&
        Number.isFinite(p.laminateWidthInsetInches) &&
        p.laminateWidthInsetInches > 0
      ) {
        d.laminateWidthInsetInches = String(p.laminateWidthInsetInches);
      }
      d.laminationRequired = true;
      return [d, ...rows.slice(1)];
    });
  }, [prefill]);

  useEffect(() => {
    if (paperGsmUserEdited) return;
    if (structuredBasisGsm != null) {
      setPaperGsm(String(structuredBasisGsm));
      return;
    }
    if (
      !hasStructuredPaperBasisLb &&
      paperCaliperPtResolved != null &&
      gsmFromCaliperPtRule != null
    ) {
      setPaperGsm(String(gsmFromCaliperPtRule));
      return;
    }
    if (!paperDescriptionComposed.trim()) {
      setPaperGsm("");
      return;
    }
    if (parsedPaperSpec.gsm != null && parsedPaperSpec.gsm > 0) {
      setPaperGsm(String(parsedPaperSpec.gsm));
    }
  }, [
    structuredBasisGsm,
    paperDescriptionComposed,
    parsedPaperSpec,
    paperGsmUserEdited,
    hasStructuredPaperBasisLb,
    paperCaliperPtResolved,
    gsmFromCaliperPtRule,
  ]);

  const selectedRoll = filmsList.find((f) => f.id === filmId);
  const selectedSecondRoll = filmsList.find((f) => f.id === secondFilmId);
  const priceFromRoll = selectedRoll?.pricePerFilmSquareInch ?? 0;
  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) ?? null,
    [machines, machineId],
  );
  const machineForScenarioRunTime = useMemo(() => {
    if (!laminationRequired || !selectedMachine) return null;
    return {
      maxSpeedMetersMin: selectedMachine.maxSpeedMetersMin,
      maxTotalSlowdownPercent: selectedMachine.maxTotalSlowdownPercent,
      makeReadyMinutes: selectedMachine.makeReadyMinutes,
      extraMakeReadyDigitalMinutes: selectedMachine.extraMakeReadyDigitalMinutes,
      extraMakeReadyOffsetMinutes: selectedMachine.extraMakeReadyOffsetMinutes,
      sideChangeMinutes: selectedMachine.sideChangeMinutes,
      washUpMinutes: selectedMachine.washUpMinutes,
      speedReductionRules: selectedMachine.speedReductionRules.map((r) => ({
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
    };
  }, [laminationRequired, selectedMachine]);
  const spoilagePaperBasisForJob = useMemo(() => {
    const h = basisKindHintForForm;
    return h === "text" || h === "cover" ? h : null;
  }, [basisKindHintForForm]);

  const spoilagePct = useMemo(() => {
    if (!laminationRequired) return 0;
    if (!selectedMachine || !Number.isInteger(qtyNum) || qtyNum <= 0) return 0;
    const fallback = Number.isFinite(selectedMachine.spoilagePercent)
      ? selectedMachine.spoilagePercent
      : 0;
    return spoilagePercentForQuantity(
      qtyNum,
      selectedMachine.spoilageRules.map((r) => ({
        sortOrder: r.sortOrder,
        quantityMin: r.quantityMin,
        quantityMax: r.quantityMax,
        spoilagePercent: r.spoilagePercent,
        paperBasis: r.paperBasis,
      })),
      fallback,
      { paperBasis: spoilagePaperBasisForJob, secondPass: secondPassEnabled },
    );
  }, [laminationRequired, selectedMachine, qtyNum, spoilagePaperBasisForJob, secondPassEnabled]);
  const productionQty = useMemo(
    () => productionSheetCount(qtyNum, spoilagePct),
    [qtyNum, spoilagePct],
  );

  const finalWForCutter =
    finalSheetWidthInches.trim() === "" ? null : Number(finalSheetWidthInches);
  const finalLForCutter =
    finalSheetLengthInches.trim() === "" ? null : Number(finalSheetLengthInches);

  const skidFinishedDimsForScenario = useMemo(() => {
    const finW =
      finalWForCutter != null && Number.isFinite(finalWForCutter) && finalWForCutter > 0
        ? finalWForCutter
        : Number.isFinite(matWNum) && matWNum > 0
          ? matWNum
          : null;
    const finL =
      finalLForCutter != null && Number.isFinite(finalLForCutter) && finalLForCutter > 0
        ? finalLForCutter
        : Number.isFinite(sheetLenNum) && sheetLenNum > 0
          ? sheetLenNum
          : null;
    return { finW, finL };
  }, [finalWForCutter, finalLForCutter, matWNum, sheetLenNum]);

  const trimRequiresCutter = useMemo(
    () =>
      parentFinalDimensionsDifferForCutter(
        matWNum,
        sheetLenNum,
        finalWForCutter,
        finalLForCutter,
      ),
    [matWNum, sheetLenNum, finalWForCutter, finalLForCutter],
  );

  /** First active cutter (by name) when trim ≠ parent; matches API auto-assign. */
  const autoCutterMachineId = useMemo(() => {
    if (!trimRequiresCutter || cutterMachines.length === 0) return "";
    return cutterMachines[0]!.id;
  }, [trimRequiresCutter, cutterMachines]);

  const trimYieldOpts = useMemo(
    () => ({
      noBleedDutchCut: finalTrimNoBleedDutchCut,
      isPressReady,
    }),
    [finalTrimNoBleedDutchCut, isPressReady],
  );

  const piecesPerSheetNum = useMemo(() => {
    if (
      finalWForCutter == null ||
      finalLForCutter == null ||
      !Number.isFinite(finalWForCutter) ||
      !Number.isFinite(finalLForCutter) ||
      finalWForCutter <= 0 ||
      finalLForCutter <= 0
    ) {
      return 1;
    }
    if (
      !Number.isFinite(matWNum) ||
      matWNum <= 0 ||
      !Number.isFinite(sheetLenNum) ||
      sheetLenNum <= 0
    ) {
      return 1;
    }
    return calculateYield(matWNum, sheetLenNum, finalWForCutter, finalLForCutter, trimYieldOpts);
  }, [matWNum, sheetLenNum, finalWForCutter, finalLForCutter, trimYieldOpts]);

  const trimLayoutPreview = useMemo(() => {
    if (
      finalWForCutter == null ||
      finalLForCutter == null ||
      !Number.isFinite(finalWForCutter) ||
      !Number.isFinite(finalLForCutter) ||
      finalWForCutter <= 0 ||
      finalLForCutter <= 0 ||
      !Number.isFinite(matWNum) ||
      matWNum <= 0 ||
      !Number.isFinite(sheetLenNum) ||
      sheetLenNum <= 0
    ) {
      return null;
    }
    return calculateTrimImpositionBest(
      matWNum,
      sheetLenNum,
      finalWForCutter,
      finalLForCutter,
      finalTrimNoBleedDutchCut,
      { isPressReady },
    );
  }, [matWNum, sheetLenNum, finalWForCutter, finalLForCutter, finalTrimNoBleedDutchCut, isPressReady]);

  const finishedPiecesPreview = useMemo(
    () => finishedPieceCount(qtyNum, piecesPerSheetNum),
    [qtyNum, piecesPerSheetNum],
  );

  const trimImpositionBlocksSubmit = useMemo(() => {
    if (finalSheetWidthInches.trim() === "" || finalSheetLengthInches.trim() === "") {
      return false;
    }
    if (finalWForCutter == null || finalLForCutter == null) {
      return false;
    }
    if (
      !Number.isFinite(finalWForCutter) ||
      !Number.isFinite(finalLForCutter) ||
      finalWForCutter <= 0 ||
      finalLForCutter <= 0
    ) {
      return false;
    }
    if (
      !Number.isFinite(matWNum) ||
      matWNum <= 0 ||
      !Number.isFinite(sheetLenNum) ||
      sheetLenNum <= 0
    ) {
      return false;
    }
    return piecesPerSheetNum < 1;
  }, [
    finalSheetWidthInches,
    finalSheetLengthInches,
    finalWForCutter,
    finalLForCutter,
    matWNum,
    sheetLenNum,
    piecesPerSheetNum,
  ]);

  const trimImpositionError = useMemo(
    () =>
      trimImpositionBlocksSubmit
        ? "No finished pieces fit for this trim size. Bleed layout reserves 0.25 in unless Dutch cut or press-ready is on. Widen the sheet or reduce final size."
        : null,
    [trimImpositionBlocksSubmit],
  );

  const selectedCutter = useMemo(
    () =>
      autoCutterMachineId
        ? (cutterMachines.find((m) => m.id === autoCutterMachineId) ?? null)
        : null,
    [autoCutterMachineId, cutterMachines],
  );

  const cutterCutsPreview = useMemo(() => {
    const zero = {
      ok: true as const,
      baseCuts: 0,
      edgeTrimCuts: 0,
      separatingCuts: 0,
      piecesPerSheet: 1,
      message: null as string | null,
    };
    if (!autoCutterMachineId || !selectedCutter) {
      return zero;
    }
    if (
      finalSheetWidthInches.trim() === "" ||
      finalSheetLengthInches.trim() === "" ||
      !Number.isFinite(finalWForCutter) ||
      !Number.isFinite(finalLForCutter)
    ) {
      return {
        ok: false as const,
        baseCuts: 0,
        edgeTrimCuts: 0,
        separatingCuts: 0,
        piecesPerSheet: piecesPerSheetNum,
        message: "Enter final width and length when final trim differs from the parent sheet.",
      };
    }
    const r = computeCutterBaseCutsFromTrim(
      matWNum,
      sheetLenNum,
      finalWForCutter,
      finalLForCutter,
      finalTrimNoBleedDutchCut,
      isPressReady,
    );
    if (!r.ok) {
      return {
        ok: false as const,
        baseCuts: 0,
        edgeTrimCuts: 0,
        separatingCuts: 0,
        piecesPerSheet: piecesPerSheetNum,
        message: r.error,
      };
    }
    return {
      ok: true as const,
      baseCuts: r.baseCuts,
      edgeTrimCuts: r.edgeTrimCuts,
      separatingCuts: r.separatingCuts,
      piecesPerSheet: r.piecesPerSheet,
      message: null as string | null,
    };
  }, [
    autoCutterMachineId,
    selectedCutter,
    finalSheetWidthInches,
    finalSheetLengthInches,
    finalWForCutter,
    finalLForCutter,
    matWNum,
    sheetLenNum,
    piecesPerSheetNum,
    finalTrimNoBleedDutchCut,
    isPressReady,
  ]);

  const cutterStackThicknessResolve = useMemo(() => {
    if (!autoCutterMachineId || !cutterCutsPreview.ok) return null;
    if (
      !Number.isInteger(qtyNum) ||
      qtyNum <= 0 ||
      !Number.isFinite(productionQty) ||
      productionQty < 0
    ) {
      return null;
    }
    if (cutterCutsPreview.baseCuts <= 0) return null;
    return resolveCutterSheetThicknessInches({
      stockType: effectiveStockType,
      paperDescription: paperDescriptionComposed.trim(),
      paperRefRows,
      manualInches:
        sheetThicknessInches.trim() === "" ? null : Number(sheetThicknessInches.trim()),
      paperCaliperPt: paperCaliperPtResolved,
    });
  }, [
    autoCutterMachineId,
    cutterCutsPreview,
    qtyNum,
    productionQty,
    effectiveStockType,
    paperDescriptionComposed,
    paperRefRows,
    sheetThicknessInches,
    paperCaliperPtResolved,
  ]);

  const skidPackThicknessResolve = useMemo(() => {
    if (!skidPackEnabled) return null;
    if (
      autoCutterMachineId &&
      cutterCutsPreview.ok &&
      cutterCutsPreview.baseCuts > 0 &&
      cutterStackThicknessResolve != null &&
      cutterStackThicknessResolve.ok
    ) {
      return cutterStackThicknessResolve;
    }
    if (
      !Number.isInteger(qtyNum) ||
      qtyNum <= 0 ||
      !Number.isFinite(productionQty) ||
      productionQty < 0
    ) {
      return null;
    }
    return resolveCutterSheetThicknessInches({
      stockType: effectiveStockType,
      paperDescription: paperDescriptionComposed.trim(),
      paperRefRows,
      manualInches:
        sheetThicknessInches.trim() === "" ? null : Number(sheetThicknessInches.trim()),
      paperCaliperPt: paperCaliperPtResolved,
    });
  }, [
    skidPackEnabled,
    autoCutterMachineId,
    cutterCutsPreview,
    cutterStackThicknessResolve,
    qtyNum,
    productionQty,
    effectiveStockType,
    paperDescriptionComposed,
    paperRefRows,
    sheetThicknessInches,
    paperCaliperPtResolved,
  ]);

  const previewSkidPack = useMemo(() => {
    const empty = {
      inboundSkids: 0,
      outboundSkids: 0,
      costUsd: 0,
      sheetsPerSkidInbound: 0,
      sheetsPerSkidOutbound: 0,
      laminatedThicknessInches: 0,
      substrateThicknessInches: 0,
      filmAddedThicknessInches: 0,
      error: null as string | null,
    };
    if (!skidPackEnabled) return empty;
    if (laminationRequired && !selectedRoll) {
      return { ...empty, error: "Select a film roll for skid pack (film thickness adds to stack height)." };
    }
    const finW =
      finalWForCutter != null && Number.isFinite(finalWForCutter) && finalWForCutter > 0
        ? finalWForCutter
        : Number.isFinite(matWNum) && matWNum > 0
          ? matWNum
          : null;
    const finL =
      finalLForCutter != null && Number.isFinite(finalLForCutter) && finalLForCutter > 0
        ? finalLForCutter
        : Number.isFinite(sheetLenNum) && sheetLenNum > 0
          ? sheetLenNum
          : null;
    if (finW == null || finL == null) {
      return { ...empty, error: "Enter sheet dimensions (and final trim if applicable) for skid pack." };
    }
    const thickRes = skidPackThicknessResolve;
    if (thickRes == null || !thickRes.ok) {
      return {
        ...empty,
        error:
          thickRes && !thickRes.ok
            ? thickRes.error
            : autoCutterMachineId
              ? "Resolve substrate thickness for skid stack height (cutter caliper or manual)."
              : "Enter substrate thickness or match stock in PaperRef for skid pack.",
      };
    }
    const secondMil =
      laminationRequired && secondPassEnabled && !secondFilmSameAsFirst && selectedSecondRoll
        ? selectedSecondRoll.thicknessMil
        : null;
    const skid = estimateSkidPack({
      productionSheetCount: productionQty,
      finalTrimPiecesPerSheet: Math.max(1, piecesPerSheetNum),
      parentWidthInches: matWNum,
      parentLengthInches: sheetLenNum,
      finishedWidthInches: finW,
      finishedLengthInches: finL,
      substrateThicknessInches: thickRes.inches,
      primaryFilmThicknessMil:
        laminationRequired && selectedRoll ? selectedRoll.thicknessMil : 0,
      secondPassEnabled: laminationRequired ? secondPassEnabled : false,
      secondFilmSameAsFirst: laminationRequired ? secondFilmSameAsFirst : true,
      secondFilmThicknessMil: secondMil,
      pricePerSkidUsd: Number.isFinite(skidShippingSettings.pricePerSkidUsd)
        ? skidShippingSettings.pricePerSkidUsd
        : 0,
      maxStackHeightInches: skidShippingSettings.maxStackHeightInches,
      maxSkidWeightLbs: skidShippingSettings.maxSkidWeightLbs,
      paperGsm: Number.isFinite(effectiveGsm) && effectiveGsm > 0 ? effectiveGsm : null,
    });
    if (!skid) {
      return {
        ...empty,
        error:
          "Skid pack could not fit finished size on parent sheet footprint, or caliper/film data is invalid.",
      };
    }
    return {
      inboundSkids: skid.inboundSkids,
      outboundSkids: skid.outboundSkids,
      costUsd: skid.costUsd,
      sheetsPerSkidInbound: skid.sheetsPerSkidInbound,
      sheetsPerSkidOutbound: skid.sheetsPerSkidOutbound,
      laminatedThicknessInches: skid.laminatedThicknessInches,
      substrateThicknessInches: thickRes.inches,
      filmAddedThicknessInches: skid.filmAddedThicknessInches,
      error: null,
    };
  }, [
    skidPackEnabled,
    laminationRequired,
    selectedRoll,
    selectedSecondRoll,
    secondPassEnabled,
    secondFilmSameAsFirst,
    skidPackThicknessResolve,
    productionQty,
    piecesPerSheetNum,
    matWNum,
    sheetLenNum,
    finalWForCutter,
    finalLForCutter,
    autoCutterMachineId,
    skidShippingSettings,
    effectiveGsm,
  ]);

  const previewCutterLabor = useMemo(() => {
    const empty = {
      hours: 0,
      totalUsd: 0,
      machineUsd: 0,
      laborUsd: 0,
      totalCuts: 0,
      numLifts: 0,
      sheetsPerLift: 0,
      error: null as string | null,
      oversize: false,
      liftCappedForOversize: false,
      usingHelperLaborRate: false,
      effectiveLaborHourlyRate: 0,
      effectiveLiftMaxHeightInches: null as number | null,
    };
    if (!cutterCutsPreview.ok || !selectedCutter) {
      return empty;
    }
    if (
      !Number.isInteger(qtyNum) ||
      qtyNum <= 0 ||
      !Number.isFinite(productionQty) ||
      productionQty < 0
    ) {
      return empty;
    }
    const profile = {
      cutterBaseSetupHours: selectedCutter.cutterBaseSetupHours,
      cutterBuildLiftHours: selectedCutter.cutterBuildLiftHours,
      cutterAdditionalSetupHoursPerCut: selectedCutter.cutterAdditionalSetupHoursPerCut,
      cutterPerCutHours: selectedCutter.cutterPerCutHours,
    };
    if (cutterCutsPreview.baseCuts <= 0) {
      return empty;
    }
    const thickRes = cutterStackThicknessResolve;
    if (thickRes == null || !thickRes.ok) {
      return {
        ...empty,
        error: thickRes && !thickRes.ok ? thickRes.error : "Enter sheet thickness for cutter lifts.",
      };
    }
    if (
      finalWForCutter == null ||
      finalLForCutter == null ||
      !Number.isFinite(finalWForCutter) ||
      !Number.isFinite(finalLForCutter) ||
      finalWForCutter <= 0 ||
      finalLForCutter <= 0
    ) {
      return empty;
    }
    const oversizeRes = resolveCutterOversizeForEstimate({
      sheetWidthInches: finalWForCutter,
      sheetLengthInches: finalLForCutter,
      cutterMaxHeightInches: selectedCutter.cutterMaxHeightInches,
      cutterOversizeMinLongEdgeInches: selectedCutter.cutterOversizeMinLongEdgeInches,
      cutterOversizeMaxLiftHeightInches: selectedCutter.cutterOversizeMaxLiftHeightInches,
      laborHourlyRate: selectedCutter.laborHourlyRate,
      cutterHelperLaborHourlyRate: selectedCutter.cutterHelperLaborHourlyRate,
    });
    const liftPlan = cutterLiftPlan(
      productionQty,
      thickRes.inches,
      oversizeRes.effectiveLiftMaxHeightInches,
    );
    if (!liftPlan.ok) {
      return { ...empty, error: liftPlan.error };
    }
    const totalCuts = totalCutterStrokes(
      cutterCutsPreview.baseCuts,
      liftPlan.numLifts,
    );
    const labor = estimateCutterLaborAndCost(
      totalCuts,
      productionQty,
      thickRes.inches,
      oversizeRes.effectiveLiftMaxHeightInches,
      profile,
      selectedCutter.hourlyRate,
      oversizeRes.effectiveLaborHourlyRate,
    );
    if (!labor.ok) {
      return { ...empty, totalCuts, error: labor.error };
    }
    return {
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
  }, [
    cutterCutsPreview,
    selectedCutter,
    qtyNum,
    productionQty,
    cutterStackThicknessResolve,
    finalWForCutter,
    finalLForCutter,
  ]);

  const filmAgg = useMemo(() => {
    if (!laminationRequired) return null;
    if (
      !selectedRoll ||
      !Number.isFinite(sheetLenNum) ||
      sheetLenNum <= 0 ||
      !Number.isInteger(qtyNum) ||
      qtyNum <= 0 ||
      !Number.isFinite(matWNum) ||
      matWNum <= 0 ||
      !Number.isFinite(priceFromRoll) ||
      priceFromRoll < 0
    ) {
      return null;
    }
    try {
      return aggregateFilmForEstimate({
        productionQuantity: productionQty,
        sheetLengthInches: sheetLenNum,
        materialWidthInches: matWNum,
        firstRoll: { rollWidth: selectedRoll.rollWidth, pricePerFilmSquareInch: priceFromRoll },
        secondPassEnabled,
        secondFilmSameAsFirst,
        secondRoll:
          secondPassEnabled && !secondFilmSameAsFirst && selectedSecondRoll
            ? {
                rollWidth: selectedSecondRoll.rollWidth,
                pricePerFilmSquareInch: selectedSecondRoll.pricePerFilmSquareInch,
              }
            : null,
        laminateWidthInsetInches: laminateInsetForFilm,
      });
    } catch {
      return null;
    }
  }, [
    selectedRoll,
    sheetLenNum,
    qtyNum,
    matWNum,
    priceFromRoll,
    productionQty,
    secondPassEnabled,
    secondFilmSameAsFirst,
    selectedSecondRoll,
    laminationRequired,
    laminateInsetForFilm,
  ]);

  const preview = filmAgg?.primary ?? null;

  const runBreakdown = useMemo(() => {
    if (!laminationRequired) return null;
    if (!selectedMachine || !preview) return null;
    if (!Number.isFinite(effectiveGsm) || effectiveGsm <= 0) return null;
    if (!effectiveStockType || effectiveStockType === "*") return null;
    const passCount: 1 | 2 = secondPassEnabled ? 2 : 1;
    return estimateTotalRunTimeFromMachine(
      {
        maxSpeedMetersMin: selectedMachine.maxSpeedMetersMin,
        maxTotalSlowdownPercent: selectedMachine.maxTotalSlowdownPercent,
        makeReadyMinutes: selectedMachine.makeReadyMinutes,
        extraMakeReadyDigitalMinutes: selectedMachine.extraMakeReadyDigitalMinutes,
        extraMakeReadyOffsetMinutes: selectedMachine.extraMakeReadyOffsetMinutes,
        sideChangeMinutes: selectedMachine.sideChangeMinutes,
        washUpMinutes: selectedMachine.washUpMinutes,
        speedReductionRules: selectedMachine.speedReductionRules.map((r) => ({
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
        paperGsm: effectiveGsm,
        stockType: effectiveStockType,
        quantity: productionQty,
        linearFeet: preview.estimatedLinearFeet,
        printType: printProcess,
        paperColor,
        sheetWidthInches: matWNum,
        sheetLengthInches: sheetLenNum,
        filmMaterialType: selectedRoll?.materialType,
      },
      { passCount, linearFeetOnePass: preview.estimatedLinearFeet },
    );
  }, [
    selectedMachine,
    preview,
    effectiveGsm,
    effectiveStockType,
    productionQty,
    secondPassEnabled,
    printProcess,
    paperColor,
    matWNum,
    sheetLenNum,
    selectedRoll,
    laminationRequired,
  ]);

  const runSheetsPerHour = useMemo(() => {
    if (!runBreakdown || !Number.isFinite(runBreakdown.effectiveMpm) || runBreakdown.effectiveMpm <= 0)
      return null;
    return sheetsPerHourFromMpm(runBreakdown.effectiveMpm, sheetLenNum);
  }, [runBreakdown, sheetLenNum]);

  const estimateConversionUsd = useMemo(() => {
    if (!selectedMachine || !runBreakdown) return null;
    if (
      !Number.isFinite(runBreakdown.totalMinutes) ||
      !Number.isFinite(runBreakdown.runMinutes) ||
      !Number.isFinite(runBreakdown.setupMinutes)
    ) {
      return null;
    }
    return estimateConversionFromRunBreakdown(
      runBreakdown.runMinutes,
      runBreakdown.setupMinutes,
      {
        hourlyRate: selectedMachine.hourlyRate,
        laborHourlyRate: selectedMachine.laborHourlyRate,
      },
    );
  }, [selectedMachine, runBreakdown]);

  const previewFinalDeliveryUsd = useMemo(() => {
    if (!includesFinalDelivery) return 0;
    const t = finalDeliveryCostInput.trim();
    if (t === "") return 0;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }, [includesFinalDelivery, finalDeliveryCostInput]);

  const scenarioCompareBase = useMemo((): Omit<ScenarioGrandTotalInput, "orderSheetQty"> | null => {
    if (orderLines.length !== 1) return null;
    if (!qtyReady || qtyNum <= 0) return null;
    if (!Number.isFinite(matWNum) || matWNum <= 0 || !Number.isFinite(sheetLenNum) || sheetLenNum <= 0) {
      return null;
    }
    if (laminationRequired) {
      if (!selectedRoll || !selectedMachine) return null;
      if (!Number.isFinite(effectiveGsm) || effectiveGsm <= 0) return null;
      if (!effectiveStockType || effectiveStockType === "*") return null;
    }
    const firstRoll = selectedRoll
      ? {
          rollWidth: selectedRoll.rollWidth,
          pricePerFilmSquareInch: selectedRoll.pricePerFilmSquareInch,
          materialType: selectedRoll.materialType,
          thicknessMil: selectedRoll.thicknessMil,
        }
      : null;
    const secondRoll =
      secondPassEnabled && !secondFilmSameAsFirst && selectedSecondRoll
        ? {
            rollWidth: selectedSecondRoll.rollWidth,
            pricePerFilmSquareInch: selectedSecondRoll.pricePerFilmSquareInch,
            thicknessMil: selectedSecondRoll.thicknessMil,
          }
        : null;
    const spoilageRules = selectedMachine
      ? selectedMachine.spoilageRules.map((r) => ({
          sortOrder: r.sortOrder,
          quantityMin: r.quantityMin,
          quantityMax: r.quantityMax,
          spoilagePercent: r.spoilagePercent,
          paperBasis: r.paperBasis,
        }))
      : [];
    const spoilageFallback =
      selectedMachine && Number.isFinite(selectedMachine.spoilagePercent)
        ? selectedMachine.spoilagePercent
        : 0;
    const thickSkid = skidPackThicknessResolve;
    const skidSubstrateThicknessInches =
      thickSkid != null && thickSkid.ok ? thickSkid.inches : null;
    const thickCut = cutterStackThicknessResolve;
    const substrateThicknessForCutter = thickCut != null && thickCut.ok ? thickCut.inches : null;

    const sw = skidFinishedDimsForScenario.finW;
    const sl = skidFinishedDimsForScenario.finL;

    return {
      laminationRequired,
      secondPassEnabled,
      secondFilmSameAsFirst,
      sheetLenNum,
      matWNum,
      laminateWidthInsetInches: laminateInsetForFilm,
      firstRoll,
      secondRoll,
      machineForRunTime: machineForScenarioRunTime,
      machineHourlyRate: selectedMachine?.hourlyRate ?? 0,
      machineLaborHourlyRate: selectedMachine?.laborHourlyRate ?? 0,
      effectiveGsm,
      effectiveStockType,
      printProcess,
      paperColor,
      spoilageRules,
      spoilageFallback,
      spoilagePaperBasisForJob,
      skidPackEnabled,
      skidShippingSettings: {
        pricePerSkidUsd: Number.isFinite(skidShippingSettings.pricePerSkidUsd)
          ? skidShippingSettings.pricePerSkidUsd
          : 0,
        maxStackHeightInches: skidShippingSettings.maxStackHeightInches,
        maxSkidWeightLbs: skidShippingSettings.maxSkidWeightLbs,
      },
      skidFinishedWidthInches: sw ?? 0,
      skidFinishedLengthInches: sl ?? 0,
      skidSubstrateThicknessInches,
      piecesPerSheetNum,
      laminationFilmMil: selectedRoll?.thicknessMil ?? 0,
      secondFilmMil:
        laminationRequired && secondPassEnabled && !secondFilmSameAsFirst && selectedSecondRoll
          ? selectedSecondRoll.thicknessMil
          : null,
      paperGsmForSkid: Number.isFinite(effectiveGsm) && effectiveGsm > 0 ? effectiveGsm : null,
      trimRequiresCutter,
      cutterBaseCuts: cutterCutsPreview.ok ? cutterCutsPreview.baseCuts : 0,
      cutterProfile: selectedCutter
        ? {
            cutterBaseSetupHours: selectedCutter.cutterBaseSetupHours,
            cutterBuildLiftHours: selectedCutter.cutterBuildLiftHours,
            cutterAdditionalSetupHoursPerCut: selectedCutter.cutterAdditionalSetupHoursPerCut,
            cutterPerCutHours: selectedCutter.cutterPerCutHours,
          }
        : {
            cutterBaseSetupHours: 0,
            cutterBuildLiftHours: 0,
            cutterAdditionalSetupHoursPerCut: 0,
            cutterPerCutHours: 0,
          },
      cutterHourlyRate: selectedCutter?.hourlyRate ?? 0,
      cutterLaborHourlyRate: selectedCutter?.laborHourlyRate ?? 0,
      cutterHelperLaborHourlyRate: selectedCutter?.cutterHelperLaborHourlyRate ?? null,
      cutterMaxHeightInches: selectedCutter?.cutterMaxHeightInches ?? null,
      cutterOversizeMinLongEdgeInches: selectedCutter?.cutterOversizeMinLongEdgeInches ?? null,
      cutterOversizeMaxLiftHeightInches: selectedCutter?.cutterOversizeMaxLiftHeightInches ?? null,
      substrateThicknessForCutter,
      finalWForCutter: finalWForCutter ?? 0,
      finalLForCutter: finalLForCutter ?? 0,
      includesFinalDelivery,
      finalDeliveryUsd: previewFinalDeliveryUsd,
    };
  }, [
    orderLines.length,
    qtyReady,
    qtyNum,
    matWNum,
    sheetLenNum,
    laminationRequired,
    selectedRoll,
    selectedSecondRoll,
    selectedMachine,
    effectiveGsm,
    effectiveStockType,
    secondPassEnabled,
    secondFilmSameAsFirst,
    printProcess,
    paperColor,
    spoilagePaperBasisForJob,
    laminateInsetForFilm,
    machineForScenarioRunTime,
    skidPackEnabled,
    skidShippingSettings,
    skidFinishedDimsForScenario,
    skidPackThicknessResolve,
    cutterStackThicknessResolve,
    piecesPerSheetNum,
    trimRequiresCutter,
    cutterCutsPreview,
    selectedCutter,
    finalWForCutter,
    finalLForCutter,
    includesFinalDelivery,
    previewFinalDeliveryUsd,
  ]);

  const scenarioQtyCompareRows = useMemo(() => {
    const base = scenarioCompareBase;
    if (!base || orderLines.length !== 1) return [];
    const extra = parseCompareSheetQuantities(compareSheetQtyInput);
    const merged = [...new Set([qtyNum, ...extra])]
      .sort((a, b) => a - b)
      .slice(0, MAX_COMPARE_SHEET_QTY_SCENARIOS);
    return merged.map((orderSheetQty) => ({
      orderSheetQty,
      ...computeScenarioGrandTotalUsd({ ...base, orderSheetQty }),
    }));
  }, [scenarioCompareBase, orderLines.length, compareSheetQtyInput, qtyNum]);

  const compareQtyParsed = useMemo(
    () => parseCompareSheetQuantities(compareSheetQtyInput),
    [compareSheetQtyInput],
  );
  const showCompareQtyTable =
    scenarioCompareBase != null &&
    orderLines.length === 1 &&
    qtyReady &&
    (compareQtyParsed.length > 0 || scenarioQtyCompareRows.length > 1);

  const [scenarioViewOrderQty, setScenarioViewOrderQty] = useState<number | null>(null);

  useEffect(() => {
    const ids = new Set(scenarioQtyCompareRows.map((r) => r.orderSheetQty));
    if (scenarioViewOrderQty != null && !ids.has(scenarioViewOrderQty)) {
      setScenarioViewOrderQty(null);
    }
  }, [scenarioQtyCompareRows, scenarioViewOrderQty]);

  const viewOrderQty = scenarioViewOrderQty ?? qtyNum;

  const scenarioFullPreview = useMemo(() => {
    if (!scenarioCompareBase || orderLines.length !== 1) return null;
    const q = scenarioViewOrderQty ?? qtyNum;
    if (q === qtyNum) return null;
    return computeScenarioFullPreview({ ...scenarioCompareBase, orderSheetQty: q });
  }, [scenarioCompareBase, orderLines.length, scenarioViewOrderQty, qtyNum]);

  const previewGrandTotalUsd = useMemo(() => {
    if (!laminationRequired) {
      const conv = estimateConversionUsd;
      return (
        (conv?.machine ?? 0) +
        (conv?.labor ?? 0) +
        previewCutterLabor.totalUsd +
        previewSkidPack.costUsd +
        previewFinalDeliveryUsd
      );
    }
    if (!filmAgg) return null;
    const conv = estimateConversionUsd;
    return (
      filmAgg.totalCostFromFilm +
      (conv?.machine ?? 0) +
      (conv?.labor ?? 0) +
      previewCutterLabor.totalUsd +
      previewSkidPack.costUsd +
      previewFinalDeliveryUsd
    );
  }, [
    laminationRequired,
    filmAgg,
    estimateConversionUsd,
    previewCutterLabor,
    previewSkidPack,
    previewFinalDeliveryUsd,
  ]);

  const viewFilmAgg =
    scenarioFullPreview != null && scenarioFullPreview.error != null
      ? null
      : scenarioFullPreview != null
        ? scenarioFullPreview.filmAgg
        : filmAgg;
  const viewPreview = viewFilmAgg?.primary ?? null;
  const viewProductionQty =
    scenarioFullPreview != null ? scenarioFullPreview.productionQty : productionQty;
  const viewSpoilagePct =
    scenarioFullPreview != null ? scenarioFullPreview.spoilagePct : spoilagePct;
  const viewRunBreakdown =
    scenarioFullPreview != null && scenarioFullPreview.error != null
      ? null
      : scenarioFullPreview != null
        ? scenarioFullPreview.runBreakdown
        : runBreakdown;
  const viewEstimateConversionUsd =
    scenarioFullPreview != null && scenarioFullPreview.error != null
      ? null
      : scenarioFullPreview != null
        ? scenarioFullPreview.estimateConversionUsd
        : estimateConversionUsd;
  const viewPreviewCutterLabor =
    scenarioFullPreview != null ? scenarioFullPreview.previewCutterLabor : previewCutterLabor;
  const viewPreviewSkidPack =
    scenarioFullPreview != null ? scenarioFullPreview.previewSkidPack : previewSkidPack;
  const viewPreviewGrandTotalUsd =
    scenarioFullPreview != null && scenarioFullPreview.error != null
      ? null
      : scenarioFullPreview != null
        ? scenarioFullPreview.previewGrandTotalUsd
        : previewGrandTotalUsd;

  const viewRunSheetsPerHour = useMemo(() => {
    if (!viewRunBreakdown || !Number.isFinite(viewRunBreakdown.effectiveMpm) || viewRunBreakdown.effectiveMpm <= 0)
      return null;
    return sheetsPerHourFromMpm(viewRunBreakdown.effectiveMpm, sheetLenNum);
  }, [viewRunBreakdown, sheetLenNum]);

  const showScenarioQtyToggle = scenarioQtyCompareRows.length > 1;

  const creditLimitExceededPreview = useMemo(() => {
    if (!crmContext || crmContext.creditLimit == null || crmContext.creditLimit <= 0) return false;
    const total = viewPreviewGrandTotalUsd;
    if (total == null || !Number.isFinite(total)) return false;
    return total > crmContext.creditLimit;
  }, [crmContext, viewPreviewGrandTotalUsd]);

  const widthExceeded = useMemo(() => {
    if (!laminationRequired) return false;
    if (!selectedMachine || !Number.isFinite(matWNum) || matWNum <= 0) return false;
    return matWNum > selectedMachine.maxWidthInches + 1e-9;
  }, [laminationRequired, selectedMachine, matWNum]);

  const sheetBoundsError = useMemo(() => {
    if (!laminationRequired) return null;
    if (!selectedMachine || !Number.isFinite(matWNum) || !Number.isFinite(sheetLenNum)) {
      return null;
    }
    const v = validateSheetAgainstMachineBounds(matWNum, sheetLenNum, {
      minSheetWidthInches: selectedMachine.minSheetWidthInches,
      maxSheetWidthInches: selectedMachine.maxSheetWidthInches,
      minSheetLengthInches: selectedMachine.minSheetLengthInches,
      maxSheetLengthInches: selectedMachine.maxSheetLengthInches,
    });
    return v.ok ? null : v.message;
  }, [laminationRequired, selectedMachine, matWNum, sheetLenNum]);

  const dimensionError = useMemo(() => {
    if (!laminationRequired) return null;
    if (
      !selectedRoll ||
      !Number.isFinite(matWNum) ||
      matWNum <= 0 ||
      !Number.isInteger(qtyNum) ||
      qtyNum <= 0 ||
      !Number.isFinite(sheetLenNum) ||
      sheetLenNum <= 0
    ) {
      return null;
    }
    try {
      aggregateFilmForEstimate({
        productionQuantity: productionQty,
        sheetLengthInches: sheetLenNum,
        materialWidthInches: matWNum,
        firstRoll: { rollWidth: selectedRoll.rollWidth, pricePerFilmSquareInch: priceFromRoll >= 0 ? priceFromRoll : 0 },
        secondPassEnabled,
        secondFilmSameAsFirst,
        secondRoll:
          secondPassEnabled && !secondFilmSameAsFirst && selectedSecondRoll
            ? {
                rollWidth: selectedSecondRoll.rollWidth,
                pricePerFilmSquareInch: selectedSecondRoll.pricePerFilmSquareInch,
              }
            : null,
        laminateWidthInsetInches: laminateInsetForFilm,
      });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Check dimensions";
    }
  }, [
    selectedRoll,
    selectedSecondRoll,
    matWNum,
    qtyNum,
    sheetLenNum,
    priceFromRoll,
    productionQty,
    secondPassEnabled,
    secondFilmSameAsFirst,
    laminationRequired,
    laminateInsetForFilm,
  ]);

  const paperFieldsOk =
    (paperDescriptionComposed.trim() !== "" || paperCaliperPtResolved != null) &&
    Number.isFinite(effectiveGsm) &&
    effectiveGsm > 0 &&
    effectiveStockType !== "" &&
    effectiveStockType !== "*";

  const finalDeliveryInputInvalid =
    includesFinalDelivery &&
    finalDeliveryCostInput.trim() !== "" &&
    (() => {
      const n = Number(finalDeliveryCostInput.trim());
      return !Number.isFinite(n) || n < 0;
    })();

  type EstimateStepId =
    | "crm"
    | "description"
    | "paper"
    | "trim"
    | "sheet"
    | "lamination"
    | "finish";

  const stepSequence = useMemo((): EstimateStepId[] => {
    const s: EstimateStepId[] = ["crm", "description", "paper", "trim", "sheet"];
    if (laminationRequired) s.push("lamination");
    s.push("finish");
    return s;
  }, [laminationRequired]);

  useEffect(() => {
    setActiveStep((i) => Math.min(i, Math.max(0, stepSequence.length - 1)));
  }, [stepSequence.length]);

  const currentStepId = stepSequence[activeStep] ?? "crm";

  const trimStepValid =
    !trimImpositionBlocksSubmit ||
    finalSheetWidthInches.trim() === "" ||
    finalSheetLengthInches.trim() === "";

  const sheetStepValid =
    descriptionStepValid &&
    qtyNumbersOk &&
    Number.isFinite(matWNum) &&
    matWNum > 0 &&
    Number.isFinite(sheetLenNum) &&
    sheetLenNum > 0;

  const laminationStepValid =
    !laminationRequired ||
    (Boolean(filmId) &&
      !dimensionError &&
      (!secondPassEnabled || secondFilmSameAsFirst || Boolean(secondFilmId)));

  const canSubmit =
    crmContext != null &&
    (partDrafts.length >= 2 ||
      ((laminationRequired ? filmAgg != null && preview != null : true) &&
        !dimensionError &&
        !sheetBoundsError &&
        paperFieldsOk &&
        !trimImpositionBlocksSubmit &&
        cutterCutsPreview.ok &&
        (!trimRequiresCutter || autoCutterMachineId) &&
        (!autoCutterMachineId || previewCutterLabor.error === null) &&
        (!skidPackEnabled || previewSkidPack.error === null) &&
        !finalDeliveryInputInvalid));

  const stepReady = useMemo(
    () => ({
      crm: crmContext != null,
      description: descriptionStepValid,
      paper: paperFieldsOk,
      trim: trimStepValid,
      sheet: sheetStepValid,
      lamination: laminationStepValid,
      finish: canSubmit,
    }),
    [
      crmContext,
      descriptionStepValid,
      sheetStepValid,
      paperFieldsOk,
      trimStepValid,
      laminationStepValid,
      canSubmit,
    ],
  );

  const isLastStep = activeStep >= stepSequence.length - 1;

  const renderStepFooter = (stepKey: keyof typeof stepReady) => (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 print:hidden">
      {activeStep > 0 && (
        <button
          type="button"
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Back
        </button>
      )}
      {!isLastStep ? (
        <button
          type="button"
          disabled={!stepReady[stepKey]}
          onClick={() => setActiveStep((s) => Math.min(stepSequence.length - 1, s + 1))}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Continue
        </button>
      ) : (
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save estimate"}
        </button>
      )}
    </div>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!crmContext) {
      setError("Select a company and contact first (use Back to change workflow if this persists).");
      return;
    }

    if (partDrafts.length < 2) {
      const nextTabErr: Partial<
        Record<"description" | "paper" | "trim" | "sheet" | "lamination" | "finish", boolean>
      > = {};
      if (!descriptionStepValid) nextTabErr.description = true;
      if (!paperFieldsOk) nextTabErr.paper = true;
      if (trimImpositionBlocksSubmit) nextTabErr.trim = true;
      if (
        !qtyReady ||
        qtyNum <= 0 ||
        !Number.isFinite(matWNum) ||
        matWNum <= 0 ||
        !Number.isFinite(sheetLenNum) ||
        sheetLenNum <= 0
      ) {
        nextTabErr.sheet = true;
      }
      if (laminationRequired && (!filmId || dimensionError)) nextTabErr.lamination = true;
      if (
        (skidPackEnabled && previewSkidPack.error) ||
        (autoCutterMachineId && previewCutterLabor.error) ||
        finalDeliveryInputInvalid
      ) {
        nextTabErr.finish = true;
      }
      if (Object.keys(nextTabErr).length > 0) {
        const order = [
          "description",
          "paper",
          "trim",
          "sheet",
          "lamination",
          "finish",
        ] as const;
        const first = order.find((k) => nextTabErr[k]);
        if (first) {
          const idx = stepSequence.indexOf(first);
          if (idx >= 0) setActiveStep(idx);
        }
        setError("Complete the highlighted step(s) before saving.");
        return;
      }
    }

    if (partDrafts.length >= 2) {
      for (let i = 0; i < partDrafts.length; i++) {
        const d = partDrafts[i]!;
        if (d.laminationRequired && !d.filmId) {
          setActivePartIdx(i);
          setError(`Part ${i + 1}: Select a film roll.`);
          return;
        }
        const qty = qtyTotalFromOrderLines(d);
        if (!qty.ok || qty.total <= 0) {
          setActivePartIdx(i);
          const hasEmptyDescription = d.orderLines.some((r) => r.label.trim() === "");
          setError(
            hasEmptyDescription
              ? `Part ${i + 1}: Enter a part description for each line.`
              : `Part ${i + 1}: Enter a positive whole-number sheet quantity for each row.`,
          );
          return;
        }
        const g = effectiveGsmFromDraft(d);
        const paperDesc = paperDescriptionComposedFromDraft(d);
        const ptDraft = Number(d.paperCaliperPt.trim());
        const hasPt = Number.isFinite(ptDraft) && ptDraft > 0;
        const est = d.stockType === "__custom__" ? d.customStockType.trim() : d.stockType;
        if (
          (paperDesc.trim() === "" && !hasPt) ||
          !Number.isFinite(g) ||
          g <= 0 ||
          est === "" ||
          est === "*"
        ) {
          setActivePartIdx(i);
          setError(
            `Part ${i + 1}: Choose Offset or Digital, enter paper / GSM (or caliper pt + stock), and select stock category.`,
          );
          return;
        }
        if (
          d.laminationRequired &&
          d.secondPassEnabled &&
          !d.secondFilmSameAsFirst &&
          !d.secondFilmId
        ) {
          setActivePartIdx(i);
          setError(`Part ${i + 1}: Choose a second film roll, or same film for both passes.`);
          return;
        }
      }

      setSaving(true);
      try {
        const partsPayload = partDrafts.map((d) => partDraftToEstimatePostFields(d));
        const res = await fetch("/api/estimates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: crmContext.companyId,
            contactId: crmContext.contactId,
            parts: partsPayload,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not save estimate");
          return;
        }
        if (typeof data.estimateId === "string") {
          router.push(`/estimates/${data.estimateId}`);
          return;
        }
        setError("Unexpected response");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (laminationRequired && !filmId) {
      setError("Add a film roll in inventory first, or select one.");
      return;
    }
    if (!qtyReady || qtyNum <= 0) {
      setError("Enter a positive whole-number sheet quantity for each part row.");
      return;
    }
    if (laminationRequired && (!filmAgg || !preview)) {
      setError(
        "Enter valid sheet width, sheet length, and quantities. Set film $/MSI on the roll in inventory if needed.",
      );
      return;
    }
    if (laminationRequired && secondPassEnabled && !secondFilmSameAsFirst && !secondFilmId) {
      setError("Choose a second film roll, or check “same film for both passes.”");
      return;
    }
    if (!paperFieldsOk) {
      setError(
        "Choose Offset or Digital, enter basis lb + text/cover (+ finish), a freeform / GSM paper line, or caliper (pt) with stock category, and select stock category.",
      );
      return;
    }
    if (trimImpositionBlocksSubmit) {
      setError(
        "No finished pieces fit for this trim size. Try Dutch cut or press-ready, or change dimensions.",
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: crmContext.companyId,
          contactId: crmContext.contactId,
          laminationRequired,
          filmInventoryId: laminationRequired ? filmId : null,
          sheetLengthInches: sheetLenNum,
          lines: orderLines.map((l) => ({
            label: l.label.trim(),
            quantity: Math.floor(Number(l.quantity.trim())),
          })),
          materialWidthInches: matWNum,
          laminateWidthInsetInches: laminateInsetForFilm,
          machineId: laminationRequired ? machineId || null : null,
          printProcess,
          paperGsm: effectiveGsm,
          stockType: effectiveStockType,
          paperColor,
          paperDescription: paperDescriptionComposed.trim(),
          paperCaliperPt: paperCaliperPtResolved,
          secondPassEnabled: laminationRequired ? secondPassEnabled : false,
          secondFilmSameAsFirst: laminationRequired ? secondFilmSameAsFirst : true,
          secondFilmInventoryId:
            laminationRequired && secondPassEnabled && !secondFilmSameAsFirst
              ? secondFilmId || null
              : null,
          finalSheetWidthInches:
            finalSheetWidthInches.trim() === "" ? null : Number(finalSheetWidthInches),
          finalSheetLengthInches:
            finalSheetLengthInches.trim() === "" ? null : Number(finalSheetLengthInches),
          finalTrimNoBleedDutchCut,
          isPressReady,
          includesFinalDelivery,
          finalDeliveryCostUsd: includesFinalDelivery
            ? finalDeliveryCostInput.trim() === ""
              ? 0
              : Number(finalDeliveryCostInput.trim())
            : null,
          finalDeliveryNotes:
            includesFinalDelivery && finalDeliveryNotes.trim() !== ""
              ? finalDeliveryNotes.trim().slice(0, 2000)
              : null,
          sheetThicknessInches:
            cutterStackThicknessResolve?.ok === true &&
            thicknessResolveUsesPaperRef(cutterStackThicknessResolve.source)
              ? null
              : sheetThicknessInches.trim() === ""
                ? null
                : Number(sheetThicknessInches.trim()),
          skidPackEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save estimate");
        return;
      }
      if (typeof data.estimateId === "string") {
        router.push(`/estimates/${data.estimateId}`);
        return;
      }
      setError("Unexpected response");
    } finally {
      setSaving(false);
    }
  }

  if (filmsList.length === 0 && laminationRequired) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No film rolls in inventory.{" "}
        <Link href="/inventory" className="font-medium underline hover:no-underline">
          Add rolls first
        </Link>
        , or turn off <span className="font-medium">Lamination required</span> for a paper-only quote.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      {workflowBanner && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
          <p className="font-semibold text-sky-950">{workflowBanner.title}</p>
          <p className="mt-1 text-sky-900/90">{workflowBanner.body}</p>
          {workflowBanner.sourceEstimateId ? (
            <p className="mt-2 text-xs text-sky-900/80">
              Source:{" "}
              <Link
                href={`/estimates/${workflowBanner.sourceEstimateId}`}
                className="font-medium underline hover:no-underline"
              >
                Estimate{" "}
                {workflowBanner.sourceEstimateNumber != null
                  ? `#${workflowBanner.sourceEstimateNumber}`
                  : workflowBanner.sourceEstimateId.slice(0, 8)}
              </Link>
            </p>
          ) : null}
        </div>
      )}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] gap-8 lg:items-start print:block">
        <div className="min-w-0 space-y-6 print:min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3 print:hidden">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Estimate wizard</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                Step {activeStep + 1} of {stepSequence.length}
                <span className="ml-2 font-normal text-zinc-500">
                  ·{" "}
                  {currentStepId === "crm" && "Customer"}
                  {currentStepId === "description" && "Part description"}
                  {currentStepId === "paper" && "Paper & stock"}
                  {currentStepId === "trim" && "Final cut & yield"}
                  {currentStepId === "sheet" && "Press sheet & quantity"}
                  {currentStepId === "lamination" && "Film"}
                  {currentStepId === "finish" && "Delivery & finishing"}
                </span>
              </p>
            </div>
          </div>

      {currentStepId === "crm" && (
      <div key="crm" className="estimate-step-enter space-y-4">
      {crmContext ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Customer</p>
          <p className="mt-1 font-medium text-zinc-900">
            <Link href={`/crm/accounts/${crmContext.companyId}`} className="underline hover:no-underline">
              {crmContext.companyName}
            </Link>
          </p>
          {crmContext.companyAddress ? (
            <p className="mt-1 whitespace-pre-wrap text-zinc-700">{crmContext.companyAddress}</p>
          ) : null}
          <p className="mt-2 text-zinc-800">
            {crmContext.contactFirstName} {crmContext.contactLastName}
            {crmContext.contactEmail?.trim() ? (
              <>
                {" · "}
                <a href={`mailto:${crmContext.contactEmail}`} className="underline">
                  {crmContext.contactEmail}
                </a>
              </>
            ) : (
              <span className="text-zinc-500"> · No email on file</span>
            )}
            {crmContext.contactPhone ? ` · ${crmContext.contactPhone}` : null}
          </p>
          {crmContext.creditLimit != null && crmContext.creditLimit > 0 ? (
            <p className="mt-2 text-xs text-zinc-600">
              Credit limit:{" "}
              <span className="tabular-nums font-medium text-zinc-800">
                ${crmContext.creditLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              {creditLimitExceededPreview ? (
                <span className="ml-2 font-medium text-amber-800">
                  — exceeds limit; save will flag accounting review
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No customer selected. Use <span className="font-medium">Back — Change workflow</span> and complete
          step 1.
        </div>
      )}
      {renderStepFooter("crm")}
      </div>
      )}

      {currentStepId === "description" && (
      <div key="description" className="estimate-step-enter space-y-4">
      <div
        id="wiz-part"
        className="scroll-mt-24 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {partDrafts.length > 1 ? "Quote parts (same letter)" : "Estimate"}
          </span>
          {partDrafts.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActivePartIdx(i)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                i === activePartIdx
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
              }`}
            >
              Part {i + 1}
            </button>
          ))}
          {partDrafts.length < MAX_BUNDLE_PARTS ? (
            <button
              type="button"
              onClick={() => addBundlePartTab()}
              className="rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              + Add part
            </button>
          ) : null}
          {partDrafts.length > 1 ? (
            <button
              type="button"
              onClick={() => removeBundlePartTab(activePartIdx)}
              className="ml-auto rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100"
            >
              Remove this part
            </button>
          ) : null}
        </div>
        {partDrafts.length > 1 ? (
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="bundle-part-label">
              Tab description (optional — quote letter & tabs)
            </label>
            <input
              id="bundle-part-label"
              type="text"
              maxLength={BUNDLE_PART_LABEL_MAX}
              value={partLabel}
              onChange={(e) => setPartLabel(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
              placeholder={`e.g. Cover, Insert — Part ${activePartIdx + 1}`}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Part descriptions
          </span>
          <p className="mt-1 text-[11px] text-zinc-600">
            One line per part on the same press sheet and lamination run. Sheet counts and press size come in a
            later step.
          </p>
        </div>
        <div className="space-y-4">
          {orderLines.map((row) => (
            <div
              key={row.id}
              className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Part description
                </span>
                <input
                  required
                  type="text"
                  value={row.label}
                  onChange={(e) =>
                    setOrderLines((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="e.g. Cover, Insert B"
                  autoComplete="off"
                />
              </label>
              {orderLines.length > 1 ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOrderLines((prev) => prev.filter((r) => r.id !== row.id))}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {orderLines.length < MAX_ESTIMATE_LINES ? (
          <button
            type="button"
            onClick={() => setOrderLines((prev) => [...prev, mkLine()])}
            className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900"
          >
            Add another part
          </button>
        ) : (
          <p className="text-xs text-zinc-500">Maximum {MAX_ESTIMATE_LINES} parts.</p>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm print:hidden">
        <input
          type="checkbox"
          checked={laminationRequired}
          onChange={(e) => setLaminationRequired(e.target.checked)}
          className="rounded border-zinc-300"
        />
        <span>
          <span className="font-medium text-zinc-900">Lamination required</span>
          <span className="mt-0.5 block text-xs font-normal text-zinc-500">
            Turn on to quote film, laminator time, and second-pass options.
          </span>
        </span>
      </label>
      {renderStepFooter("description")}
      </div>
      )}

      {currentStepId === "paper" && (
      <div key="paper" className="estimate-step-enter space-y-4">
      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset
          id="wiz-paper"
          className="scroll-mt-24 block sm:col-span-2 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-4"
        >
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Paper &amp; print (required)
          </legend>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Print process
            </span>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="printProcess"
                  checked={printProcess === "Offset"}
                  onChange={() => setPrintProcess("Offset")}
                  className="border-zinc-300 text-zinc-900"
                />
                Offset
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="printProcess"
                  checked={printProcess === "Digital"}
                  onChange={() => setPrintProcess("Digital")}
                  className="border-zinc-300 text-zinc-900"
                />
                Digital
              </label>
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Paper color
            </span>
            <select
              value={paperColor}
              onChange={(e) => setPaperColor(e.target.value as EstimatePaperColor)}
              className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            >
              {ESTIMATE_PAPER_COLOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500">
              White vs colored stock for machine slowdown rules (defaults to white).
            </p>
          </label>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Paper basis (US stock)
            </span>
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
              Basis <span className="font-medium text-zinc-700">lb</span> uses standard 500-sheet sizes:
              text/book <span className="tabular-nums">25×38</span> in, cover{" "}
              <span className="tabular-nums">20×26</span> in → GSM for machine rules. Or use{" "}
              <span className="font-medium text-zinc-700">caliper (pt)</span> with stock category (no lb
              needed) so thickness comes from the ref sheet’s <span className="font-medium">Caliper (Inches)</span>{" "}
              column; GSM uses <span className="font-medium">pt × {GSM_PER_CALIPER_PT}</span> when lb is not used.
              Or ignore lb and type a freeform line / GSM in notes + weight field.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Basis weight (lb / #)
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={paperBasisLb}
                  onChange={(e) => {
                    setPaperBasisLb(e.target.value);
                    setPaperGsmUserEdited(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="e.g. 80"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Basis type
                </span>
                <select
                  value={paperBasisKind}
                  onChange={(e) => {
                    setPaperBasisKind(e.target.value as "" | "text" | "cover");
                    setPaperGsmUserEdited(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="">— (use notes / GSM only)</option>
                  <option value="text">Text / book</option>
                  <option value="cover">Cover</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Surface
                </span>
                <select
                  value={paperFinish}
                  onChange={(e) => {
                    setPaperFinish(e.target.value as PaperSurfaceFinish);
                    setPaperGsmUserEdited(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="coated">Coated</option>
                  <option value="uncoated">Uncoated</option>
                  <option value="C1S">C1S</option>
                  <option value="C2S">C2S</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Caliper (pt)
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={paperCaliperPt}
                  onChange={(e) => {
                    setPaperCaliperPt(e.target.value);
                    setPaperGsmUserEdited(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="e.g. 7.5"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Looks up your pt in PaperRef “Caliper (pt)” and uses the row’s “Caliper (Inches)” for
                  stack / lift math. When basis lb is not used, GSM uses pt × {GSM_PER_CALIPER_PT}.
                </p>
              </label>
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Extra description (optional)
              </span>
              <input
                value={paperNotes}
                onChange={(e) => {
                  setPaperNotes(e.target.value);
                  setPaperGsmUserEdited(false);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder='e.g. "white", brand, or freeform line like "270 gsm" if not using lb above'
              />
            </label>
            {paperDescriptionComposed.trim() !== "" && (
              <p className="mt-2 rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-800">
                Saved as: {paperDescriptionComposed}
              </p>
            )}
            {structuredBasisGsm != null && (
              <p className="mt-1.5 text-xs text-zinc-600">
                → <span className="font-medium tabular-nums">{structuredBasisGsm} GSM</span> from{" "}
                {paperBasisLb} lb {paperBasisKind} (basis sheet)
                {paperGsmUserEdited ? " — GSM field overridden below" : ""}.
              </p>
            )}
            {gsmFromCaliperPtRule != null && paperCaliperPtResolved != null && (
              <p className="mt-1.5 text-xs text-zinc-600">
                → <span className="font-medium tabular-nums">{gsmFromCaliperPtRule} GSM</span> from caliper{" "}
                {paperCaliperPtResolved} pt × {GSM_PER_CALIPER_PT} (basis lb not used)
                {paperGsmUserEdited ? " — GSM field overridden below" : ""}.
              </p>
            )}
            {structuredBasisGsm == null &&
              gsmFromCaliperPtRule == null &&
              paperDescriptionComposed.trim() !== "" &&
              parsedPaperSpec.gsm != null && (
                <p className="mt-1.5 text-xs text-zinc-600">
                  → <span className="font-medium tabular-nums">{parsedPaperSpec.gsm} GSM</span>
                  {parsedPaperSpec.detail ? ` (${parsedPaperSpec.detail})` : ""} for speed rules.
                </p>
              )}
            {paperDescriptionComposed.trim() !== "" &&
              parsedPaperSpec.gsm == null &&
              parsedPaperSpec.method === "none" &&
              gsmFromCaliperPtRule == null && (
                <p className="mt-1.5 text-xs text-amber-800">
                  No automatic GSM from this line — enter basis lb + text/cover, caliper (pt) (pt ×{" "}
                  {GSM_PER_CALIPER_PT} when lb is not used), or type GSM in the field below.
                </p>
              )}
          </div>
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white/80 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Sheet weight (from GSM)
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              One sheet mass:{" "}
              <code className="rounded bg-zinc-100 px-1">GSM × width (m) × length (m)</code> grams →
              pounds. Uses effective GSM and sheet width / length from this form.
            </p>
            {sheetWeightPreview ? (
              <p className="mt-2 text-sm tabular-nums text-zinc-900">
                <span className="font-medium">
                  {sheetWeightPreview.grams.toLocaleString(undefined, { maximumFractionDigits: 2 })} g
                </span>
                <span className="text-zinc-500"> · </span>
                <span className="font-medium">
                  {sheetWeightPreview.lbs.toLocaleString(undefined, { maximumFractionDigits: 4 })} lb
                </span>
                <span className="text-zinc-600">
                  {" "}
                  per sheet ({matWNum} × {sheetLenNum} in)
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                Enter valid GSM, sheet width, and sheet length to see per-sheet weight.
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Paper weight (GSM)
              </span>
              <input
                type="number"
                min={0.001}
                step="any"
                value={paperGsm}
                onChange={(e) => {
                  setPaperGsmUserEdited(true);
                  setPaperGsm(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="Filled from lb basis, or type GSM"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Override when you know metric weight or the basis line is approximate.
              </p>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Stock category
              </span>
              <select
                required
                value={stockType}
                onChange={(e) => setStockType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="" disabled>
                  Select…
                </option>
                {ESTIMATE_STOCK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {stockType === "__custom__" && (
                <input
                  value={customStockType}
                  onChange={(e) => setCustomStockType(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Custom label (matches speed rules)"
                />
              )}
            </label>
          </div>
        </fieldset>
      </div>
      {renderStepFooter("paper")}
      </div>
      )}

      {currentStepId === "trim" && (
      <div key="trim" className="estimate-step-enter space-y-4">
      <div className="grid gap-6 sm:grid-cols-2">
        <p className="text-[11px] text-zinc-600 sm:col-span-2">
          Finished size after laminate and guillotine. Enter the parent (press) sheet on the next step — yield
          below updates once that size is set.
        </p>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Final width (inches, optional)
          </span>
          <input
            type="number"
            min={0}
            step="any"
            value={finalSheetWidthInches}
            onChange={(e) => setFinalSheetWidthInches(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Cut size after laminate"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Final length (inches, optional)
          </span>
          <input
            type="number"
            min={0}
            step="any"
            value={finalSheetLengthInches}
            onChange={(e) => setFinalSheetLengthInches(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Cut size after laminate"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Guillotine internal cut style
          </span>
          <select
            value={finalTrimNoBleedDutchCut ? "dutch" : "bleed"}
            onChange={(e) => setFinalTrimNoBleedDutchCut(e.target.value === "dutch")}
            className="mt-1 w-full max-w-xl rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="dutch">No bleed — Dutch cut (shared gutters; fewer separating strokes)</option>
            <option value="bleed">Bleed layout (split bleed strips; more separating strokes)</option>
          </select>
        </label>

        <label className="flex cursor-pointer items-start gap-2 sm:col-span-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-100">
          <input
            type="checkbox"
            checked={isPressReady}
            onChange={(e) => setIsPressReady(e.target.checked)}
            className="mt-0.5 rounded border-zinc-300"
          />
          <span>
            <span className="font-medium text-zinc-900">Press-ready sheet</span>
            <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
              Yield uses the <strong className="font-medium text-zinc-700">full</strong> run width × length (no
              0.25 in inset), even if bleed layout is selected. Use when the sheet is already to press size or
              gripper margin does not apply.
            </span>
          </span>
        </label>

        <div className="block sm:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Pieces per sheet at final trim (calculated)
          </span>
          <p className="mt-2 text-sm font-medium tabular-nums text-zinc-900">
            {finalSheetWidthInches.trim() === "" || finalSheetLengthInches.trim() === ""
              ? "—"
              : trimImpositionBlocksSubmit
                ? "0 (does not fit)"
                : piecesPerSheetNum.toLocaleString()}
          </p>
          {trimLayoutPreview != null && !trimImpositionBlocksSubmit && (
            <p className="mt-1 text-[11px] text-zinc-600">
              Best layout:{" "}
              <span className="font-medium text-zinc-800">
                {trimLayoutPreview.columns} × {trimLayoutPreview.rows}
              </span>{" "}
              on the sheet (
              {trimLayoutPreview.rotated
                ? "final size rotated 90° vs. width/length entered"
                : "matches width × length as entered"}
              ). Yield is the <strong className="font-medium text-zinc-700">max</strong> of standard vs. rotated
              (90°) tiling, with{" "}
              {!finalTrimNoBleedDutchCut && !isPressReady ? (
                <strong className="font-medium text-zinc-700">0.25 in</strong>
              ) : (
                <strong className="font-medium text-zinc-700">no</strong>
              )}{" "}
              inset on the run sheet
              {!finalTrimNoBleedDutchCut && !isPressReady
                ? " (bleed layout)."
                : isPressReady
                  ? " (press-ready: full sheet)."
                  : " (Dutch / no bleed: full sheet)."}
            </p>
          )}
          <p className="mt-1 text-[11px] text-zinc-500">
            Exact integer fits use a tiny tolerance so 24÷12 does not drift to 1.9999→1. Cutter separating strokes
            follow the style above: Dutch uses{" "}
            <strong className="font-medium text-zinc-700">(columns − 1) + (rows − 1)</strong>; bleed uses{" "}
            <strong className="font-medium text-zinc-700">
              (columns × 2 − 2) + (rows × 2 − 2)
            </strong>
            .
          </p>
        </div>
      </div>
      {renderStepFooter("trim")}
      </div>
      )}

      {currentStepId === "sheet" && (
      <div key="sheet-qty" className="estimate-step-enter space-y-4">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sheet width (inches)
          </span>
          <input
            required
            type="number"
            min={0}
            step="any"
            value={materialWidthInches}
            onChange={(e) => setMaterialWidthInches(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Cross-web (press sheet width)"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sheet length (inches)
          </span>
          <input
            required
            type="number"
            min={0}
            step="any"
            value={sheetLengthInches}
            onChange={(e) => setSheetLengthInches(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Feed direction"
          />
        </label>

        {laminationRequired && (
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Cross-web bare margin (total inches)
            </span>
            <input
              type="number"
              min={0.125}
              max={3}
              step="any"
              value={laminateWidthInsetInches}
              onChange={(e) => setLaminateWidthInsetInches(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="0.5"
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              Laminate width = sheet width − this total margin. If the roll is <strong className="font-medium">wider
              than</strong> laminate (slitting required), use at least{" "}
              <span className="font-medium tabular-nums">{LAMINATE_WIDTH_INSET_INCHES}</span> in total (
              <span className="font-medium tabular-nums">{LAMINATE_INSET_PER_SIDE_INCHES}</span> in bare each side).
              If the roll <strong className="font-medium">matches</strong> laminate width (no slitting), you can
              use a <strong className="font-medium">larger</strong> margin — e.g. 28.125 in sheet and a{" "}
              <span className="font-medium">27.5</span> in roll →{" "}
              <span className="font-medium tabular-nums">0.625</span> in so laminate is 27.5 in.
            </p>
          </label>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Order quantity (sheets per part)
          </span>
          <p className="mt-1 text-[11px] text-zinc-600">
            Totals use the <strong>sum</strong> of all sheet counts. Costs are split by each line&apos;s share of
            that total. Use <strong className="font-medium text-zinc-700">Back</strong> to add or remove part lines
            on the description step.
          </p>
        </div>
        <div className="space-y-4">
          {orderLines.map((row) => (
            <div
              key={row.id}
              className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-zinc-700">
                {row.label.trim() ? row.label : "—"}
                <span className="font-normal text-zinc-500"> · sheets ordered</span>
              </p>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  # of sheets
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={row.quantity}
                  onChange={(e) =>
                    setOrderLines((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, quantity: e.target.value } : r)),
                    )
                  }
                  className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
                  placeholder="Sheets"
                />
              </label>
            </div>
          ))}
        </div>
        {qtyReady && qtyNum > 0 && (
          <p className="text-[11px] text-zinc-500">
            Total order sheets:{" "}
            <span className="font-medium tabular-nums text-zinc-800">
              {qtyNum.toLocaleString()}
            </span>
            . Finished pieces (order):{" "}
            <span className="font-medium tabular-nums text-zinc-700">
              {finishedPiecesPreview.toLocaleString()}
            </span>{" "}
            = total sheets × pieces/sheet above
          </p>
        )}
        {orderLines.length > 1 ? (
          <p className="text-[11px] text-zinc-600">
            To compare estimated price by sheet quantity, use a single part line on the description step (this
            quote sums multiple lines into one run).
          </p>
        ) : null}
        {orderLines.length === 1 && qtyReady && qtyNum > 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3 shadow-sm print:hidden">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Also compare sheet quantities (optional)
              </span>
              <input
                type="text"
                value={compareSheetQtyInput}
                onChange={(e) => setCompareSheetQtyInput(e.target.value)}
                className="mt-1 w-full max-w-lg rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="e.g. 500, 1000, 2500"
                autoComplete="off"
              />
            </label>
            <p className="mt-1 text-[11px] text-zinc-600">
              Comma, space, or semicolon. Preview only (not saved on the quote). Up to{" "}
              {MAX_COMPARE_SHEET_QTY_SCENARIOS} quantities including your primary sheet count.
            </p>
            {showCompareQtyTable ? (
              <div className="mt-3 overflow-x-auto rounded border border-zinc-200 bg-white">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Order sheets</th>
                      <th className="px-3 py-2">Production sheets</th>
                      <th className="px-3 py-2">Est. total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioQtyCompareRows.map((row) => (
                      <tr
                        key={row.orderSheetQty}
                        className={
                          row.orderSheetQty === qtyNum
                            ? "border-b border-zinc-100 bg-amber-50/60"
                            : "border-b border-zinc-100"
                        }
                      >
                        <td className="px-3 py-2 tabular-nums text-zinc-900">
                          {row.orderSheetQty.toLocaleString()}
                          {row.orderSheetQty === qtyNum ? (
                            <span className="ml-2 text-[11px] font-normal text-zinc-500">(primary)</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-zinc-800">
                          {row.error ? "—" : row.productionSheets.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-zinc-900">
                          {row.error ? (
                            <span className="text-xs text-red-700">{row.error}</span>
                          ) : row.totalUsd != null && Number.isFinite(row.totalUsd) ? (
                            fmtUsd(row.totalUsd, 2)
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {renderStepFooter("sheet")}
      </div>
      )}

      {currentStepId === "lamination" && laminationRequired && (
      <div key="lamination" className="estimate-step-enter space-y-4">
      <div className="grid gap-6 sm:grid-cols-2">
        <div id="wiz-film" className="scroll-mt-24 block sm:col-span-2">
          <FilmRollPicker
            label="Film roll"
            films={filmsList}
            value={filmId}
            onChange={setFilmId}
            onRollCreated={(roll) => {
              setFilmsList((prev) => [roll, ...prev]);
              setFilmId(roll.id);
            }}
          />
          {selectedRoll && (
            <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {selectedRoll.stockKind === "CATALOG" ? "Catalog film" : "On-floor stock (this roll)"}
              </p>
              {selectedRoll.vendor?.trim() ? (
                <p className="mt-1 text-xs text-zinc-600">Vendor: {selectedRoll.vendor.trim()}</p>
              ) : null}
              {selectedRoll.stockKind === "CATALOG" ? (
                <p className="mt-1 text-sm text-zinc-700">
                  Not held on the floor — order to job quantity. Reference footage in record:{" "}
                  <span className="font-medium tabular-nums text-zinc-900">
                    {selectedRoll.remainingLinearFeet.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                    lin. ft
                  </span>
                  .
                </p>
              ) : (
                <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                  {selectedRoll.remainingLinearFeet.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{" "}
                  lin. ft remaining
                </p>
              )}
              {filmAgg && (
                <p className="mt-1 text-sm text-zinc-700">
                  This estimate uses ~{" "}
                  <span className="font-medium tabular-nums text-zinc-900">
                    {(
                      secondPassEnabled && secondFilmSameAsFirst
                        ? filmAgg.primary.estimatedLinearFeet * 2
                        : filmAgg.primary.estimatedLinearFeet
                    ).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>{" "}
                  lin. ft off this roll
                  {secondPassEnabled && secondFilmSameAsFirst && " (two passes, same film)"}.
                </p>
              )}
              {filmAgg && secondPassEnabled && !secondFilmSameAsFirst && selectedSecondRoll && (
                <p className="mt-1 text-sm text-zinc-700">
                  Pass 2 roll: ~{" "}
                  <span className="font-medium tabular-nums text-zinc-900">
                    {filmAgg.secondPass?.estimatedLinearFeet.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    }) ?? "—"}
                  </span>{" "}
                  lin. ft required
                  {selectedSecondRoll.stockKind === "CATALOG" ? (
                    <> — catalog (order for job).</>
                  ) : (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium tabular-nums text-zinc-900">
                        {selectedSecondRoll.remainingLinearFeet.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </span>{" "}
                      lin. ft on hand.
                      {filmAgg.secondPass &&
                        filmAgg.secondPass.estimatedLinearFeet >
                          selectedSecondRoll.remainingLinearFeet + 1e-6 && (
                          <span className="ml-1 font-medium text-amber-800">
                            May need to order more for pass 2.
                          </span>
                        )}
                    </>
                  )}
                </p>
              )}
              {selectedRoll.stockKind !== "CATALOG" &&
                filmAgg &&
                (secondPassEnabled && secondFilmSameAsFirst
                  ? filmAgg.primary.estimatedLinearFeet * 2
                  : filmAgg.primary.estimatedLinearFeet) >
                  selectedRoll.remainingLinearFeet + 1e-6 && (
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    This job needs more linear footage than this roll shows in inventory — plan to
                    order film or pick another roll.
                  </p>
                )}
            </div>
          )}
        </div>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Laminator (for estimated run time)
          </span>
          {machines.length === 0 ? (
            <p className="mt-2 text-sm text-amber-800">
              No active machines.{" "}
              <Link href="/module-setup/estimating" className="font-medium underline">
                Add a machine
              </Link>{" "}
              to enable run-time preview.
            </p>
          ) : laminatorMachines.length === 0 ? (
            <p className="mt-2 text-sm text-amber-800">
              No laminator-type machines (machine type kind ≠ cutter). Add a laminator or set an
              existing type to Laminator under{" "}
              <Link href="/module-setup/estimating" className="font-medium underline">
                Machines
              </Link>
              .
            </p>
          ) : (
            <>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              >
                {laminatorMachines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (max {m.maxWidthInches} in wide, {m.maxSpeedMetersMin} m/min)
                  </option>
                ))}
              </select>
              {machineId && selectedMachine && (
                <p className="mt-2 text-xs text-zinc-600">
                  {selectedMachine.speedReductionRules.length > 0
                    ? `Run time uses max speed minus matching slowdowns: 1st rule at full %, 2nd at 50%, 3rd at 25%, 4th at 12.5% (halving each time), then Σ is capped at ${selectedMachine.maxTotalSlowdownPercent}% for this machine.`
                    : "Run time uses machine max speed (m/min) only — add reduction rules on the machine page to slow for specific jobs."}
                </p>
              )}
            </>
          )}
        </label>

        <div className="block space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={secondPassEnabled}
              onChange={(e) => {
                setSecondPassEnabled(e.target.checked);
                if (!e.target.checked) setSecondFilmSameAsFirst(true);
              }}
              className="rounded border-zinc-300"
            />
            Second pass (other side)
          </label>
          {secondPassEnabled && (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={secondFilmSameAsFirst}
                  onChange={(e) => setSecondFilmSameAsFirst(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Same film for both passes
              </label>
              {!secondFilmSameAsFirst && (
                <div className="block">
                  <FilmRollPicker
                    label="Second film roll"
                    films={filmsList}
                    value={secondFilmId}
                    onChange={setSecondFilmId}
                    allowEmpty
                    onRollCreated={(roll) => {
                      setFilmsList((prev) => [roll, ...prev]);
                      setSecondFilmId(roll.id);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="block rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            $ / MSI (from inventory, off roll)
          </span>
          <p className="mt-1 text-sm font-medium tabular-nums text-zinc-900">
            $
            {priceFromRoll.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}{" "}
            <span className="font-normal text-zinc-500">
              per MSI — 1000 sq in; line total = (film off roll sq in ÷ 1000) × price
            </span>
          </p>
          {selectedRoll && priceFromRoll === 0 && (
            <p className="mt-2 text-xs text-amber-800">
              Set a price on this roll under{" "}
              <Link href="/inventory" className="font-medium underline">
                Film inventory
              </Link>{" "}
              so line totals calculate.
            </p>
          )}
        </div>
      </div>
      {renderStepFooter("lamination")}
      </div>
      )}

      {currentStepId === "finish" && (
      <div key="finish" className="estimate-step-enter space-y-4">
      <div className="grid gap-6 sm:grid-cols-2">
        <div id="wiz-finish" className="scroll-mt-24 h-px w-full sm:col-span-2" aria-hidden />

        <div className="block space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={includesFinalDelivery}
              onChange={(e) => {
                setIncludesFinalDelivery(e.target.checked);
                if (!e.target.checked) {
                  setFinalDeliveryNotes("");
                  setFinalDeliveryCostInput("");
                }
              }}
              className="mt-0.5 rounded border-zinc-300"
            />
            <span>
              <span className="font-medium text-zinc-900">Include final delivery</span>
              <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                Deliver or ship finished work to the customer (quote includes this scope). Notes are optional.
              </span>
            </span>
          </label>
          {includesFinalDelivery && (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Delivery charge (USD)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={finalDeliveryCostInput}
                onChange={(e) => setFinalDeliveryCostInput(e.target.value)}
                placeholder="0 — flat amount added to estimate total"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
              />
              {finalDeliveryInputInvalid && (
                <p className="mt-1 text-xs text-amber-800">Enter a valid non-negative number for delivery.</p>
              )}
            </label>
          )}
          {includesFinalDelivery && (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Delivery notes (optional)
              </span>
              <textarea
                value={finalDeliveryNotes}
                onChange={(e) => setFinalDeliveryNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                placeholder="Address, carrier preference, timing, access instructions…"
              />
            </label>
          )}
        </div>

        {(trimRequiresCutter || cutterMachines.length > 0) && (
          <div className="block space-y-3 sm:col-span-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Cutter (trim time)
              </span>
              {trimRequiresCutter ? (
                autoCutterMachineId && selectedCutter ? (
                  <p className="mt-2 text-sm text-zinc-800">
                    <span className="font-semibold text-zinc-900">{selectedCutter.name}</span> is added
                    automatically when final trim differs from the parent sheet
                    {selectedCutter.cutterMaxHeightInches != null && selectedCutter.cutterMaxHeightInches > 0
                      ? ` (max stack ${fmtNum(selectedCutter.cutterMaxHeightInches, 3)} in)`
                      : ""}
                    .
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-800">
                    Final trim differs from the parent sheet — add an active machine with type{" "}
                    <strong className="font-medium">Cutter</strong> under{" "}
                    <Link href="/module-setup/estimating" className="font-medium underline hover:no-underline">
                      Machines
                    </Link>
                    .
                  </p>
                )
              ) : (
                <p className="mt-2 text-sm text-zinc-600">
                  No cutter is included when final width × length matches the parent sheet.
                </p>
              )}
              {trimRequiresCutter && autoCutterMachineId && (
                <p className="mt-2 text-xs text-zinc-500">
                  Trim: <strong className="font-medium text-zinc-700">total strokes = base cuts × lifts</strong>
                  . Base cuts = edge trim (4 if parent is larger on both width and length, 2 if one axis) +
                  grid separating cuts above. Lifts from stack height ÷ thickness.{" "}
                  <strong className="font-medium text-zinc-700">Lifts</strong> use substrate caliper from{" "}
                  <strong className="font-medium text-zinc-700">PaperRef.csv</strong> when stock category
                  and basis weight (# / lb in the paper line) or <strong className="font-medium">caliper (pt)</strong>{" "}
                  match a row; otherwise enter thickness manually. Priced at{" "}
                  <strong className="font-medium text-zinc-700">machine $/hr + labor $/hr</strong> on the
                  cutter record.
                </p>
              )}
              {paperRefRows.length === 0 && trimRequiresCutter && autoCutterMachineId && (
                <p className="mt-2 text-xs text-amber-800">
                  PaperRef.csv was not loaded — cutter caliper must be entered manually, or add{" "}
                  <code className="rounded bg-amber-100/80 px-1">Paper Reference/PaperRef.csv</code>.
                </p>
              )}
            </div>
            {trimRequiresCutter && autoCutterMachineId && cutterStackThicknessResolve != null && (
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Sheet thickness (inches)
                </span>
                {cutterStackThicknessResolve.ok &&
                thicknessResolveUsesPaperRef(cutterStackThicknessResolve.source) ? (
                  <>
                    <input
                      type="text"
                      readOnly
                      value={formatSheetThicknessInchesLikePaperRef(
                        cutterStackThicknessResolve.inches,
                      )}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm tabular-nums text-zinc-800"
                    />
                    <p className="mt-1 text-xs text-zinc-600">
                      From PaperRef.csv for this stock category
                      {cutterStackThicknessResolve.source === "paper_ref_pt"
                        ? " and caliper (pt)"
                        : " and basis weight"}{" "}
                      (cuts &amp; lifts use this value).
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sheetThicknessInches}
                      onChange={(e) => setSheetThicknessInches(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
                      placeholder=".0075 (inches, like PaperRef)"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      {cutterStackThicknessResolve.ok === false
                        ? cutterStackThicknessResolve.error
                        : "No matching PaperRef row — enter caliper manually. Sheets per lift ≈ floor(max stack ÷ thickness)."}
                    </p>
                  </>
                )}
              </label>
            )}
          </div>
        )}

        <div className="block space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 sm:col-span-2">
          <div className="flex flex-wrap items-start gap-3">
            <button
              type="button"
              onClick={() => setSkidPackEnabled((v) => !v)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                skidPackEnabled
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              Skid pack
            </button>
            <p className="min-w-0 flex-1 text-sm text-zinc-600">
              Pre-lam paper arrives one stack per skid (parent sheet footprint). Limits: max{" "}
              {skidShippingSettings.maxStackHeightInches.toLocaleString()}
              &Prime; height and {skidShippingSettings.maxSkidWeightLbs.toLocaleString()} lb per skid
              (uses GSM × sheet area; outbound applies ×{LAMINATED_SHEET_WEIGHT_FACTOR} for film). Restack
              tiles finished size on the parent sheet. Price = outbound skids ×{" "}
              <Link
                href="/module-setup/shipping"
                className="font-medium text-zinc-800 underline hover:no-underline"
              >
                $/skid
              </Link>
              .
            </p>
          </div>
          {skidPackEnabled &&
            skidPackThicknessResolve != null &&
            !(
              autoCutterMachineId &&
              cutterCutsPreview.ok &&
              cutterCutsPreview.baseCuts > 0 &&
              cutterStackThicknessResolve != null &&
              cutterStackThicknessResolve.ok
            ) && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Sheet thickness for skid stack height (inches)
                </span>
                {skidPackThicknessResolve.ok &&
                thicknessResolveUsesPaperRef(skidPackThicknessResolve.source) ? (
                  <>
                    <input
                      type="text"
                      readOnly
                      value={formatSheetThicknessInchesLikePaperRef(skidPackThicknessResolve.inches)}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm tabular-nums text-zinc-800"
                    />
                    <p className="mt-1 text-xs text-zinc-600">
                      From PaperRef.csv for this stock (substrate thickness × layers vs max stack height).
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sheetThicknessInches}
                      onChange={(e) => setSheetThicknessInches(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
                      placeholder=".0075 (inches, like PaperRef)"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      {skidPackThicknessResolve.ok === false
                        ? skidPackThicknessResolve.error
                        : "Enter caliper manually, or match stock in PaperRef."}
                    </p>
                  </>
                )}
              </label>
            )}
        </div>
      </div>

      <details className="live-estimate-print-root group space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 print:border-0 print:bg-transparent">
        <summary className="cursor-pointer list-none rounded-lg px-4 py-3 text-sm font-medium text-zinc-900 print:hidden [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>Advanced — line breakdown &amp; machine detail</span>
            <span className="text-xs font-normal text-zinc-500 group-open:hidden">Show</span>
            <span className="hidden text-xs font-normal text-zinc-500 group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="space-y-4 border-t border-zinc-200 px-4 pb-4 pt-3 print:border-0 print:px-0 print:pb-0 print:pt-0">
      <div
        id="live-estimate-print"
        className="space-y-4"
      >
        {showScenarioQtyToggle ? (
          <label className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm print:hidden">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              View breakdown for
            </span>
            <select
              className="mt-1 w-full max-w-xs rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums text-zinc-900"
              value={scenarioViewOrderQty ?? qtyNum}
              onChange={(e) => {
                const v = Number(e.target.value);
                setScenarioViewOrderQty(v === qtyNum ? null : v);
              }}
            >
              {scenarioQtyCompareRows.map((row) => (
                <option key={row.orderSheetQty} value={row.orderSheetQty}>
                  {row.orderSheetQty.toLocaleString()} order sheets
                  {row.orderSheetQty === qtyNum ? " (primary)" : ""}
                </option>
              ))}
            </select>
            {scenarioFullPreview ? (
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                Showing what-if costs for this sheet count. The saved quote uses the primary quantity only.
              </p>
            ) : null}
          </label>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Live estimate</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 print:hidden"
          >
            Print this estimate
          </button>
        </div>
        {widthExceeded && selectedMachine && (
          <p className="text-sm text-amber-800">
            Sheet width {fmtNum(matWNum, 3)} in exceeds this machine&apos;s max web{" "}
            {selectedMachine.maxWidthInches} in — check press capability.
          </p>
        )}
        {sheetBoundsError && (
          <p className="text-sm text-amber-800">{sheetBoundsError}</p>
        )}
        {dimensionError && <p className="text-sm text-amber-800">{dimensionError}</p>}
        {trimImpositionError && (
          <p className="text-sm text-amber-800">{trimImpositionError}</p>
        )}
        {autoCutterMachineId && !cutterCutsPreview.ok && cutterCutsPreview.message && (
          <p className="text-sm text-amber-800">{cutterCutsPreview.message}</p>
        )}
        {autoCutterMachineId && viewPreviewCutterLabor.error && (
          <p className="text-sm text-amber-800">{viewPreviewCutterLabor.error}</p>
        )}
        {skidPackEnabled && viewPreviewSkidPack.error && (
          <p className="text-sm text-amber-800">{viewPreviewSkidPack.error}</p>
        )}
        {scenarioFullPreview?.error && laminationRequired && (
          <p className="text-sm text-amber-800">{scenarioFullPreview.error}</p>
        )}
        {selectedMachine && viewSpoilagePct > 0 && Number.isInteger(viewOrderQty) && viewOrderQty > 0 && (
          <p className="text-sm text-zinc-700">
            Production sheets (order {viewOrderQty} + {viewProductionQty - viewOrderQty} spoilage @{" "}
            {viewSpoilagePct}%):{" "}
            <span className="font-semibold tabular-nums">{viewProductionQty}</span>
          </p>
        )}
        {viewPreview && viewFilmAgg && (
          <div className="-mx-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full min-w-[min(100%,36rem)] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Calculation</th>
                  <th className="px-3 py-2 text-right font-medium">Result</th>
                </tr>
              </thead>
              <LiveEstimateSection title="Quantity & film geometry">
                <LiveEstimateRow
                  item="Order quantity"
                  basis={
                    orderLines.length > 1
                      ? "Sum of part sheet counts (same run)"
                      : "Sheets ordered (integer)"
                  }
                  value={
                    qtyReady
                      ? orderLines.length > 1
                        ? `${orderLines
                            .map((l, i) => {
                              const q = Math.floor(Number(l.quantity.trim()));
                              const lbl = l.label.trim() || `Part ${i + 1}`;
                              return `${lbl}: ${Number.isInteger(q) && q > 0 ? q.toLocaleString() : "—"}`;
                            })
                            .join(" · ")} → ${qtyNum.toLocaleString()} sheets total`
                        : `${viewOrderQty.toLocaleString()} sheets`
                      : "—"
                  }
                />
                <LiveEstimateRow
                  item="Production sheets"
                  basis={
                    viewSpoilagePct > 0
                      ? `Order + spoilage @ ${viewSpoilagePct}% (machine rules)`
                      : "Same as order (no spoilage %)"
                  }
                  value={`${viewProductionQty.toLocaleString()} sheets`}
                />
                <LiveEstimateRow
                  item="Film price (roll)"
                  basis="$/MSI snapshot on primary roll (1000 sq in)"
                  value={`${fmtUsd(priceFromRoll, 4)} / MSI`}
                />
                <LiveEstimateRow
                  item="Laminate width"
                  basis={`Sheet width − ${fmtNum(laminateInsetForFilm, 4)} in (cross-web bare margin total)`}
                  value={`${fmtNum(viewPreview.laminateWidthInches, 3)} in`}
                />
                <LiveEstimateRow
                  item="Roll width"
                  basis="Primary film roll (full web priced)"
                  value={`${selectedRoll?.rollWidth ?? "—"} in`}
                />
                <LiveEstimateRow
                  item="Slit excess (cross-web)"
                  basis="Roll width − laminate width (dead stock on web)"
                  value={
                    viewPreview.slitExcessWidthInches > 0
                      ? `${fmtNum(viewPreview.slitExcessWidthInches, 3)} in`
                      : "0 in (nominal)"
                  }
                />
                <LiveEstimateRow
                  item="Web — linear inches (one pass)"
                  basis={`Production sheets × sheet length (${viewProductionQty} × ${fmtNum(sheetLenNum, 3)})`}
                  value={`${fmtNum(viewPreview.linearInches, 1)} lin in`}
                />
                <LiveEstimateRow
                  item="Web — linear feet (one pass)"
                  basis="Linear inches ÷ 12"
                  value={`${fmtNum(viewPreview.estimatedLinearFeet, 2)} ft`}
                />
                {secondPassEnabled && (
                  <LiveEstimateRow
                    item="Web — total (all passes)"
                    basis="Same web length per pass × 2 passes"
                    value={`${fmtNum(viewPreview.estimatedLinearFeet * 2, 2)} ft`}
                  />
                )}
                <LiveEstimateRow
                  item="Sheet area (reference)"
                  basis="Sheets × width × length"
                  value={`${fmtNum(viewPreview.materialSquareInches, 1)} sq in`}
                />
                <LiveEstimateRow
                  item="Film on product (laminate)"
                  basis="Laminate width × web length; summed for all passes"
                  value={`${fmtNum(viewFilmAgg.totalLaminateFilmSquareInches, 1)} sq in`}
                />
                {!secondPassEnabled && selectedRoll && (
                  <LiveEstimateRow
                    item="Film off roll (pass 1)"
                    basis={`${fmtNum(viewPreview.linearInches, 1)} lin in × ${selectedRoll.rollWidth} in`}
                    value={`${fmtNum(viewPreview.filmFromRollSquareInches, 1)} sq in`}
                  />
                )}
                {secondPassEnabled && secondFilmSameAsFirst && selectedRoll && (
                  <LiveEstimateRow
                    item="Film off roll (both passes, same roll)"
                    basis={`2 × (${fmtNum(viewPreview.linearInches, 1)} lin in × ${selectedRoll.rollWidth} in)`}
                    value={`${fmtNum(viewFilmAgg.totalFilmFromRollSquareInches, 1)} sq in`}
                  />
                )}
                {secondPassEnabled && !secondFilmSameAsFirst && viewFilmAgg.secondPass && selectedRoll && selectedSecondRoll && (
                  <>
                    <LiveEstimateRow
                      item="Film off roll — pass 1"
                      basis={`${fmtNum(viewPreview.linearInches, 1)} lin in × ${selectedRoll.rollWidth} in`}
                      value={`${fmtNum(viewFilmAgg.primary.filmFromRollSquareInches, 1)} sq in`}
                    />
                    <LiveEstimateRow
                      item="Film off roll — pass 2"
                      basis={`${fmtNum(viewFilmAgg.secondPass.linearInches, 1)} lin in × ${selectedSecondRoll.rollWidth} in`}
                      value={`${fmtNum(viewFilmAgg.secondPass.filmFromRollSquareInches, 1)} sq in`}
                    />
                  </>
                )}
                {viewFilmAgg.totalSlitWasteSquareInches > 0 && (
                  <LiveEstimateRow
                    item="Slit / side waste area (all passes)"
                    basis="Web length × slit strip × passes (priced as off-roll)"
                    value={`${fmtNum(viewFilmAgg.totalSlitWasteSquareInches, 1)} sq in`}
                  />
                )}
              </LiveEstimateSection>
              <LiveEstimateSection title="Press time (laminator)">
                {machines.length === 0 ? (
                  <LiveEstimateRow
                    item="Run time"
                    basis={
                      <span className="text-amber-800">
                        No active machines.{" "}
                        <Link href="/module-setup/estimating" className="font-medium underline hover:no-underline">
                          Add a machine
                        </Link>
                      </span>
                    }
                    value="—"
                  />
                ) : !selectedMachine ? (
                  <LiveEstimateRow item="Run time" basis="Select a laminator above" value="—" />
                ) : !viewRunBreakdown || !Number.isFinite(viewRunBreakdown.totalMinutes) ? (
                  <LiveEstimateRow
                    item="Run time"
                    basis={
                      !paperFieldsOk
                        ? "Complete paper, stock, GSM/run fields for speed rules"
                        : "Could not compute — check inputs"
                    }
                    value="—"
                  />
                ) : (
                  <>
                    <LiveEstimateRow
                      item="Make ready"
                      basis={
                        viewRunBreakdown.makeReadyExtraByPrintTypeMinutes > 0 ? (
                          <>
                            Base {fmtDurationMinutes(viewRunBreakdown.makeReadyBaseMinutes)} +{" "}
                            {fmtDurationMinutes(viewRunBreakdown.makeReadyExtraByPrintTypeMinutes)} for{" "}
                            {printProcess}
                          </>
                        ) : (
                          "Machine template (minutes)"
                        )
                      }
                      value={fmtDurationMinutes(viewRunBreakdown.makeReadyMinutes)}
                    />
                    {secondPassEnabled && (
                      <LiveEstimateRow
                        item="Side change"
                        basis="Between passes"
                        value={fmtDurationMinutes(viewRunBreakdown.sideChangeMinutes)}
                      />
                    )}
                    <LiveEstimateRow
                      item="Wash up"
                      basis="Machine template"
                      value={fmtDurationMinutes(viewRunBreakdown.washUpMinutes)}
                    />
                    {viewRunBreakdown.speedSource === "max_only" && selectedMachine && (
                      <LiveEstimateRow
                        item="Line speed (no rule reduction)"
                        basis="Rated max — reduction rules need sheet width, length, and film material type on the estimate, or no rules apply"
                        value={`${selectedMachine.maxSpeedMetersMin.toFixed(2)} m/min`}
                      />
                    )}
                    {viewRunBreakdown.speedSource === "reduction_rules" && selectedMachine && (
                      <>
                        <LiveEstimateRow
                          item="Machine rated max"
                          basis="Laminator max speed before slowdown"
                          value={`${selectedMachine.maxSpeedMetersMin.toFixed(2)} m/min`}
                        />
                        {(viewRunBreakdown.matchedSlowdownRules?.length ?? 0) === 0 ? (
                          <LiveEstimateRow
                            item="Speed rules"
                            basis="No rules matched this job — Σ slowdown = 0%"
                            value="0% added"
                          />
                        ) : (
                          (viewRunBreakdown.matchedSlowdownRules ?? []).map((r) => {
                            const frac =
                              r.nominalSlowdownPercent > 1e-9
                                ? r.appliedSlowdownPercent / r.nominalSlowdownPercent
                                : 1;
                            const pctOfRule =
                              frac >= 1 - 1e-9
                                ? "100%"
                                : `${fmtNum(frac * 100, frac < 0.02 ? 3 : 2)}%`;
                            return (
                              <LiveEstimateRow
                                key={`${r.sortOrder}-${r.name}`}
                                item={`Rule: ${r.name}`}
                                basis={
                                  frac >= 1 - 1e-9
                                    ? "Matched filters → full table % toward Σ (1st matching rule)"
                                    : `Matched filters → ${pctOfRule} of table % toward Σ`
                                }
                                value={`+${fmtNum(r.appliedSlowdownPercent, 2)}%`}
                              />
                            );
                          })
                        )}
                        <LiveEstimateRow
                          item="Σ matched rule slowdown"
                          basis="Stacked sum (halving weight: 100%, 50%, 25%, …) before machine cap"
                          value={`${fmtNum(viewRunBreakdown.rawTotalSlowdownPercent ?? 0, 2)}%`}
                        />
                        <LiveEstimateRow
                          item="Machine max total slowdown (cap)"
                          basis="Upper limit on Σ for this machine (see machine settings)"
                          value={`${fmtNum(viewRunBreakdown.maxTotalSlowdownCap ?? selectedMachine.maxTotalSlowdownPercent, 2)}%`}
                        />
                        <LiveEstimateRow
                          item="Applied slowdown"
                          basis="min(cap, Σ) — this % is subtracted from full speed"
                          value={`${fmtNum(viewRunBreakdown.appliedSlowdownPercent ?? 0, 2)}%`}
                        />
                        <LiveEstimateRow
                          item="Effective line speed"
                          basis={`${selectedMachine.maxSpeedMetersMin.toFixed(2)} × (1 − ${fmtNum(viewRunBreakdown.appliedSlowdownPercent ?? 0, 2)} ÷ 100)`}
                          value={`${viewRunBreakdown.effectiveMpm.toFixed(2)} m/min`}
                        />
                      </>
                    )}
                    <LiveEstimateRow
                      item="Run time (web at line speed)"
                      basis={
                        <>
                          {viewRunBreakdown.passCount} pass(es) @ {viewRunBreakdown.effectiveMpm.toFixed(2)} m/min
                          {viewRunBreakdown.cappedByMaxSpeed ? " (capped)" : ""}
                        </>
                      }
                      value={fmtDurationMinutes(viewRunBreakdown.runMinutes)}
                    />
                    <LiveEstimateRow
                      item="Total job time (model)"
                      basis="Make ready + side change + wash up + run"
                      value={fmtDurationMinutes(viewRunBreakdown.totalMinutes)}
                    />
                    {viewRunSheetsPerHour != null && (
                      <LiveEstimateRow
                        item="Sheets / hour (approx.)"
                        basis="Effective line speed &amp; sheet length"
                        value={formatSheetsPerHour(viewRunSheetsPerHour)}
                      />
                    )}
                  </>
                )}
              </LiveEstimateSection>
              <LiveEstimateSection title="Costs (USD)">
                <LiveEstimateRow
                  item="Film material"
                  basis={`(Off-roll sq in ÷ ${SQUARE_INCHES_PER_MSI}) × $/MSI per pass; see geometry above`}
                  value={fmtUsd(viewFilmAgg.totalCostFromFilm, 2)}
                />
                {selectedMachine && viewEstimateConversionUsd != null && (
                  <>
                    <LiveEstimateRow
                      item="Laminator machine"
                      basis={`Run/setup split × ${fmtUsd(selectedMachine.hourlyRate, 2)}/hr (machine rate)`}
                      value={fmtUsd(viewEstimateConversionUsd.machine, 2)}
                    />
                    <LiveEstimateRow
                      item="Laminator labor"
                      basis={`Total job hours × ${fmtUsd(selectedMachine.laborHourlyRate, 2)}/hr (labor rate)`}
                      value={fmtUsd(viewEstimateConversionUsd.labor, 2)}
                    />
                  </>
                )}
                {selectedMachine && viewRunBreakdown != null && viewEstimateConversionUsd == null && paperFieldsOk && (
                  <LiveEstimateRow
                    item="Laminator machine &amp; labor"
                    basis="Totals appear when job time is finite"
                    value="—"
                  />
                )}
                {autoCutterMachineId &&
                  selectedCutter &&
                  cutterCutsPreview.ok &&
                  Number.isFinite(viewProductionQty) &&
                  viewProductionQty >= 0 &&
                  viewPreviewCutterLabor.totalCuts > 0 &&
                  viewPreviewCutterLabor.error === null && (
                    <>
                      <LiveEstimateRow
                        item="Cutter — strokes"
                        basis={`Base ${cutterCutsPreview.baseCuts}/lift + edge ${cutterCutsPreview.edgeTrimCuts}${
                          cutterCutsPreview.separatingCuts > 0
                            ? ` + separate ${cutterCutsPreview.separatingCuts}`
                            : ""
                        } × ${viewPreviewCutterLabor.numLifts} lifts (~${viewPreviewCutterLabor.sheetsPerLift} sheets/lift)${
                          viewPreviewCutterLabor.oversize && viewPreviewCutterLabor.liftCappedForOversize
                            ? `; oversize max stack ${fmtNum(
                                viewPreviewCutterLabor.effectiveLiftMaxHeightInches ?? 0,
                                2,
                              )} in`
                            : viewPreviewCutterLabor.oversize
                              ? "; oversize sheet"
                              : ""
                        }`}
                        value={`${viewPreviewCutterLabor.totalCuts} strokes, ${fmtNum(viewPreviewCutterLabor.hours, 4)} hr`}
                      />
                      <LiveEstimateRow
                        item="Cutter machine"
                        basis={`Hours × ${fmtUsd(selectedCutter.hourlyRate, 2)}/hr`}
                        value={fmtUsd(viewPreviewCutterLabor.machineUsd, 2)}
                      />
                      <LiveEstimateRow
                        item="Cutter labor"
                        basis={`Hours × ${fmtUsd(viewPreviewCutterLabor.effectiveLaborHourlyRate, 2)}/hr${
                          viewPreviewCutterLabor.usingHelperLaborRate ? " (helper / oversize)" : ""
                        }`}
                        value={fmtUsd(viewPreviewCutterLabor.laborUsd, 2)}
                      />
                      <LiveEstimateRow
                        item="Cutter subtotal"
                        basis="Machine + labor"
                        value={fmtUsd(viewPreviewCutterLabor.totalUsd, 2)}
                      />
                    </>
                  )}
                {skidPackEnabled && viewPreviewSkidPack.error === null && (
                  <>
                    <LiveEstimateRow
                      item="Skid pack — skids"
                      basis={`Inbound ${viewPreviewSkidPack.inboundSkids} → outbound ${viewPreviewSkidPack.outboundSkids} (${viewPreviewSkidPack.sheetsPerSkidInbound} parent sheets/skid in, ${viewPreviewSkidPack.sheetsPerSkidOutbound} finished/skid out)`}
                      value="—"
                    />
                    <LiveEstimateRow
                      item="Skid pack — caliper"
                      basis={`${fmtNum(viewPreviewSkidPack.laminatedThicknessInches, 4)} in sheet = ${fmtNum(viewPreviewSkidPack.substrateThicknessInches, 4)} in stock + ${fmtNum(viewPreviewSkidPack.filmAddedThicknessInches, 4)} in film`}
                      value="—"
                    />
                    <LiveEstimateRow
                      item="Skid pack charge"
                      basis={`${viewPreviewSkidPack.outboundSkids} outbound skids × ${fmtUsd(skidShippingSettings.pricePerSkidUsd, 2)}/skid`}
                      value={fmtUsd(viewPreviewSkidPack.costUsd, 2)}
                    />
                  </>
                )}
                {includesFinalDelivery && (
                  <LiveEstimateRow
                    item="Final delivery"
                    basis="Flat charge from delivery field"
                    value={
                      finalDeliveryInputInvalid
                        ? "—"
                        : previewFinalDeliveryUsd <= 0
                          ? "$0.00"
                          : fmtUsd(previewFinalDeliveryUsd, 2)
                    }
                  />
                )}
              </LiveEstimateSection>
              <tbody>
                <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                  <td colSpan={2} className="px-3 py-3 text-sm font-semibold text-zinc-900">
                    Estimate total
                  </td>
                  <td className="px-3 py-3 text-right text-base font-semibold tabular-nums text-zinc-900">
                    {fmtUsd(viewPreviewGrandTotalUsd ?? viewFilmAgg.totalCostFromFilm, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
            {creditLimitExceededPreview && crmContext?.creditLimit != null ? (
              <p className="border-t border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
                Live total is above this customer&apos;s credit limit (
                ${crmContext.creditLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}). The saved
                quote will be marked for accounting review.
              </p>
            ) : null}
            {autoCutterMachineId &&
              selectedCutter &&
              cutterCutsPreview.ok &&
              viewPreviewCutterLabor.totalCuts > 0 &&
              viewPreviewCutterLabor.error === null &&
              viewPreviewCutterLabor.hours > 0 &&
              (!Number.isFinite(selectedCutter.hourlyRate) || selectedCutter.hourlyRate <= 0) &&
              (!Number.isFinite(viewPreviewCutterLabor.effectiveLaborHourlyRate) ||
                viewPreviewCutterLabor.effectiveLaborHourlyRate <= 0) && (
                <p className="border-t border-zinc-200 px-3 py-2 text-xs text-amber-800">
                  Set machine and/or labor $/hr on the cutter so cutter time contributes to the total.
                </p>
              )}
          </div>
        )}
        {!viewPreview && !dimensionError && (
          <p className="text-sm text-zinc-500">
            Enter sheet width, sheet length, and part quantities. Totals use film from the roll (slit trim
            counts as dead stock) plus machine and labor rates when a machine is selected and run time
            is calculated.
          </p>
        )}
        <p className="text-xs text-zinc-500">
          Cross-web margin is on the Press sheet step. When the roll is wider than laminate (slitting), margin must
          be at least {LAMINATE_WIDTH_INSET_INCHES} in total ({LAMINATE_INSET_PER_SIDE_INCHES} in per side). When
          roll and laminate match (no slitting), margin may be larger to suit stock rolls. Film use is full roll
          width × run length; if wider than laminate, side trim is zero or at least {MIN_SLIT_STRIP_WIDTH_INCHES}{" "}
          in (recoverable slit strip rule).
        </p>
      </div>
        </div>
      </details>
      {renderStepFooter("finish")}
      </div>
      )}

        </div>

        <aside className="sticky top-6 hidden h-fit rounded-xl border border-zinc-200 bg-white p-4 shadow-sm lg:block print:hidden">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Quote summary</p>
          {showScenarioQtyToggle ? (
            <label className="mt-2 block">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                View for
              </span>
              <select
                className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums text-zinc-900"
                value={scenarioViewOrderQty ?? qtyNum}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setScenarioViewOrderQty(v === qtyNum ? null : v);
                }}
              >
                {scenarioQtyCompareRows.map((row) => (
                  <option key={row.orderSheetQty} value={row.orderSheetQty}>
                    {row.orderSheetQty.toLocaleString()} sheets
                    {row.orderSheetQty === qtyNum ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Stock</dt>
              <dd className="max-w-[12rem] text-right font-medium leading-snug text-zinc-900">
                {effectiveStockType || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Total paper cost</dt>
              <dd className="text-right tabular-nums text-zinc-500">Not modeled</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Total film (MSI)</dt>
              <dd className="text-right tabular-nums text-zinc-800">
                {laminationRequired && viewFilmAgg
                  ? fmtUsd(viewFilmAgg.totalCostFromFilm, 2)
                  : laminationRequired
                    ? "—"
                    : fmtUsd(0, 2)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Est. run time</dt>
              <dd className="text-right tabular-nums text-zinc-800">
                {viewRunBreakdown != null && Number.isFinite(viewRunBreakdown.totalMinutes)
                  ? `${Math.round(viewRunBreakdown.totalMinutes)} min`
                  : "—"}
              </dd>
            </div>
            <div className="border-t border-zinc-200 pt-2">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-zinc-900">Grand total</dt>
                <dd className="text-right text-lg font-semibold tabular-nums text-zinc-900">
                  {viewPreviewGrandTotalUsd != null && Number.isFinite(viewPreviewGrandTotalUsd)
                    ? fmtUsd(viewPreviewGrandTotalUsd, 2)
                    : "—"}
                </dd>
              </div>
            </div>
          </dl>
          <p className="mt-3 text-[11px] leading-snug text-zinc-500">
            Substrate cost is not priced here. Total includes film (when laminating), laminator time,
            cutter, skid pack, and delivery when enabled.
          </p>
        </aside>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}
