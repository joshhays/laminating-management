import { EstimatePaperColor } from "@prisma/client";
import type { BasisKind, PaperSurfaceFinish } from "@/lib/paper-spec-to-gsm";
import { gsmFromPaperCaliperPt } from "@/lib/paper-ref";
import {
  basisKindFromEstimatePaperGrade,
  composePaperDescriptionFromFields,
  parsePaperSpecificationToGsm,
} from "@/lib/paper-spec-to-gsm";
import { LAMINATE_WIDTH_INSET_INCHES } from "@/lib/estimate-math";

/** One tab / part of a new estimate (or a single-estimate form). */
export type NewEstimatePartDraft = {
  /** When false, film / laminator / second-pass UI is hidden and the quote is substrate + finishing only. */
  laminationRequired: boolean;
  filmId: string;
  machineId: string;
  skidPackEnabled: boolean;
  printProcess: "Offset" | "Digital";
  paperColor: EstimatePaperColor;
  paperBasisLb: string;
  paperBasisKind: "" | "text" | "cover";
  paperFinish: PaperSurfaceFinish;
  paperNotes: string;
  paperGsm: string;
  paperGsmUserEdited: boolean;
  /** Caliper in points — optional alternative to basis lb for PaperRef thickness (and Approx GSM). */
  paperCaliperPt: string;
  stockType: string;
  customStockType: string;
  sheetLengthInches: string;
  orderLines: { id: string; label: string; quantity: string }[];
  /** Comma-separated extra sheet counts to compare (preview only; same part line). */
  compareSheetQtyInput: string;
  materialWidthInches: string;
  /** Total cross-web bare margin (in); laminate width = sheet width − this. Default 0.5. */
  laminateWidthInsetInches: string;
  secondPassEnabled: boolean;
  secondFilmSameAsFirst: boolean;
  secondFilmId: string;
  finalSheetWidthInches: string;
  finalSheetLengthInches: string;
  finalTrimNoBleedDutchCut: boolean;
  isPressReady: boolean;
  includesFinalDelivery: boolean;
  finalDeliveryCostInput: string;
  finalDeliveryNotes: string;
  sheetThicknessInches: string;
  partLabel: string;
};

export function createEmptyPartDraft(
  filmsArg: { id: string }[],
  laminatorMachines: { id: string }[],
  orderLineId: string,
): NewEstimatePartDraft {
  return {
    laminationRequired: false,
    filmId: filmsArg[0]?.id ?? "",
    machineId: laminatorMachines[0]?.id ?? "",
    skidPackEnabled: false,
    printProcess: "Offset",
    paperColor: EstimatePaperColor.WHITE,
    paperBasisLb: "",
    paperBasisKind: "",
    paperFinish: "coated",
    paperNotes: "",
    paperGsm: "",
    paperGsmUserEdited: false,
    paperCaliperPt: "",
    stockType: "",
    customStockType: "",
    sheetLengthInches: "",
    orderLines: [{ id: orderLineId, label: "", quantity: "" }],
    compareSheetQtyInput: "",
    materialWidthInches: "",
    laminateWidthInsetInches: "0.5",
    secondPassEnabled: false,
    secondFilmSameAsFirst: true,
    secondFilmId: "",
    finalSheetWidthInches: "",
    finalSheetLengthInches: "",
    finalTrimNoBleedDutchCut: true,
    isPressReady: false,
    includesFinalDelivery: false,
    finalDeliveryCostInput: "",
    finalDeliveryNotes: "",
    sheetThicknessInches: "",
    partLabel: "",
  };
}

function effectiveStockTypeFromDraft(d: NewEstimatePartDraft): string {
  return d.stockType === "__custom__" ? d.customStockType.trim() : d.stockType;
}

function basisKindHintForDraft(d: NewEstimatePartDraft): BasisKind | undefined {
  if (d.paperBasisKind === "text" || d.paperBasisKind === "cover") {
    return d.paperBasisKind;
  }
  if (!d.stockType) return undefined;
  if (d.stockType === "__custom__") {
    return basisKindFromEstimatePaperGrade(d.customStockType) ?? undefined;
  }
  return basisKindFromEstimatePaperGrade(d.stockType) ?? undefined;
}

export function paperDescriptionComposedFromDraft(d: NewEstimatePartDraft): string {
  const lb = Number(d.paperBasisLb);
  const pk = d.paperBasisKind;
  const hasStruct =
    Number.isFinite(lb) && lb > 0 && lb <= 500 && (pk === "text" || pk === "cover");
  if (hasStruct) {
    return composePaperDescriptionFromFields({
      basisLb: lb,
      basisKind: pk,
      finish: d.paperFinish,
      extraNotes: d.paperNotes.trim() || undefined,
    });
  }
  return d.paperNotes.trim();
}

function hasStructuredBasisFromDraft(d: NewEstimatePartDraft): boolean {
  const lb = Number(d.paperBasisLb);
  return (
    Number.isFinite(lb) &&
    lb > 0 &&
    lb <= 500 &&
    (d.paperBasisKind === "text" || d.paperBasisKind === "cover")
  );
}

export function effectiveGsmFromDraft(d: NewEstimatePartDraft): number {
  const gsmNum = Number(d.paperGsm);
  const basisKindHint = basisKindHintForDraft(d);
  const paperDescriptionComposed = paperDescriptionComposedFromDraft(d);
  const parsed = parsePaperSpecificationToGsm(
    paperDescriptionComposed,
    basisKindHint ? { basisKindHint } : undefined,
  );
  if (Number.isFinite(gsmNum) && gsmNum > 0) {
    return gsmNum;
  }
  if (parsed.gsm != null && parsed.gsm > 0) {
    return parsed.gsm;
  }
  if (!hasStructuredBasisFromDraft(d)) {
    const pt = Number(d.paperCaliperPt);
    if (Number.isFinite(pt) && pt > 0) {
      const g = gsmFromPaperCaliperPt(pt);
      if (Number.isFinite(g) && g > 0) return g;
    }
  }
  return NaN;
}

export function qtyTotalFromOrderLines(d: NewEstimatePartDraft): { ok: true; total: number } | { ok: false } {
  if (d.orderLines.length === 0) return { ok: false };
  let total = 0;
  for (const row of d.orderLines) {
    if (row.label.trim() === "") return { ok: false };
    const t = row.quantity.trim();
    if (t === "") return { ok: false };
    const q = Math.floor(Number(t));
    if (!Number.isInteger(q) || q <= 0) return { ok: false };
    total += q;
  }
  return { ok: true, total };
}

/** Body for POST /api/estimates (one part, merged with top-level company/contact for bundles). */
export function partDraftToEstimatePostFields(d: NewEstimatePartDraft): Record<string, unknown> {
  const matWNum = Number(d.materialWidthInches);
  const sheetLenNum = Number(d.sheetLengthInches);
  const effectiveStockType = effectiveStockTypeFromDraft(d);
  const effectiveGsm = effectiveGsmFromDraft(d);
  const paperDescriptionComposed = paperDescriptionComposedFromDraft(d);

  return {
    partLabel: d.partLabel.trim(),
    laminationRequired: d.laminationRequired,
    filmInventoryId: d.laminationRequired ? d.filmId : "",
    sheetLengthInches: sheetLenNum,
    lines: d.orderLines.map((l) => ({
      label: l.label.trim(),
      quantity: Math.floor(Number(l.quantity.trim())),
    })),
    materialWidthInches: matWNum,
    laminateWidthInsetInches: (() => {
      const raw = d.laminateWidthInsetInches.trim();
      const n = raw === "" ? LAMINATE_WIDTH_INSET_INCHES : Number(raw);
      return Number.isFinite(n) ? n : LAMINATE_WIDTH_INSET_INCHES;
    })(),
    machineId: d.laminationRequired ? d.machineId || null : null,
    printProcess: d.printProcess,
    paperGsm: effectiveGsm,
    stockType: effectiveStockType,
    paperColor: d.paperColor,
    paperDescription: paperDescriptionComposed.trim(),
    secondPassEnabled: d.laminationRequired ? d.secondPassEnabled : false,
    secondFilmSameAsFirst: d.laminationRequired ? d.secondFilmSameAsFirst : true,
    secondFilmInventoryId:
      d.laminationRequired && d.secondPassEnabled && !d.secondFilmSameAsFirst
        ? d.secondFilmId || null
        : null,
    finalSheetWidthInches:
      d.finalSheetWidthInches.trim() === "" ? null : Number(d.finalSheetWidthInches),
    finalSheetLengthInches:
      d.finalSheetLengthInches.trim() === "" ? null : Number(d.finalSheetLengthInches),
    finalTrimNoBleedDutchCut: d.finalTrimNoBleedDutchCut,
    isPressReady: d.isPressReady,
    includesFinalDelivery: d.includesFinalDelivery,
    finalDeliveryCostUsd: d.includesFinalDelivery
      ? d.finalDeliveryCostInput.trim() === ""
        ? 0
        : Number(d.finalDeliveryCostInput.trim())
      : null,
    finalDeliveryNotes:
      d.includesFinalDelivery && d.finalDeliveryNotes.trim() !== ""
        ? d.finalDeliveryNotes.trim().slice(0, 2000)
        : null,
    sheetThicknessInches:
      d.sheetThicknessInches.trim() === "" ? null : Number(d.sheetThicknessInches.trim()),
    skidPackEnabled: d.skidPackEnabled,
    paperCaliperPt:
      d.paperCaliperPt.trim() === ""
        ? null
        : (() => {
            const n = Number(d.paperCaliperPt.trim());
            return Number.isFinite(n) && n > 0 ? n : null;
          })(),
  };
}
