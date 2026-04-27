/**
 * Hierarchical estimating entry: category → context-specific next options → lamination quote form.
 * (Press-only / finishing / mailing quoting can plug in here later.)
 */

import type { EstimatePaperColor } from "@prisma/client";

export type EstimateWorkflowCategory =
  | "lamination"
  | "print-then-laminate"
  | "print-only"
  | "finishing"
  | "mailing";

export type LaminationEntryMode = "standalone" | "after-press";

export type AfterPressSourceMode = "from-estimate" | "manual";

/** Row returned from Prisma for prefill picker (subset of Estimate). */
export type EstimatePrefillListItem = {
  id: string;
  estimateNumber: number | null;
  materialWidthInches: number | null;
  sheetLengthInches: number;
  quantity: number;
  paperDescription: string | null;
  paperGsm: number | null;
  stockType: string | null;
  printType: string | null;
  paperColor: EstimatePaperColor;
  finalSheetWidthInches: number | null;
  finalSheetLengthInches: number | null;
  sheetThicknessInches: number | null;
  finalTrimIsPressReady: boolean;
  laminateWidthInsetInches: number | null;
};

export type EstimateFormWorkflowBanner = {
  title: string;
  body: string;
  sourceEstimateId?: string;
  sourceEstimateNumber?: number | null;
};

/** Snapshot applied once when opening the lamination form (e.g. after picking a source estimate). */
export type EstimateFormPrefill = {
  materialWidthInches: number | null;
  sheetLengthInches: number;
  quantity: number;
  paperDescription: string;
  paperGsm: number | null;
  stockType: string | null;
  printType: string | null;
  paperColor: EstimatePaperColor;
  finalSheetWidthInches: number | null;
  finalSheetLengthInches: number | null;
  sheetThicknessInches: number | null;
  finalTrimIsPressReady: boolean | null;
  laminateWidthInsetInches: number | null;
};

export function estimateToFormPrefill(e: EstimatePrefillListItem): EstimateFormPrefill {
  return {
    materialWidthInches: e.materialWidthInches,
    sheetLengthInches: e.sheetLengthInches,
    quantity: e.quantity,
    paperDescription: e.paperDescription ?? "",
    paperGsm: e.paperGsm,
    stockType: e.stockType,
    printType: e.printType,
    paperColor: e.paperColor,
    finalSheetWidthInches: e.finalSheetWidthInches,
    finalSheetLengthInches: e.finalSheetLengthInches,
    sheetThicknessInches: e.sheetThicknessInches,
    finalTrimIsPressReady: e.finalTrimIsPressReady ? true : null,
    laminateWidthInsetInches:
      e.laminateWidthInsetInches != null && Number.isFinite(e.laminateWidthInsetInches)
        ? e.laminateWidthInsetInches
        : null,
  };
}

export function formatEstimatePickLabel(e: EstimatePrefillListItem): string {
  const num = e.estimateNumber != null ? `#${e.estimateNumber}` : e.id.slice(0, 8);
  const w = e.materialWidthInches != null ? e.materialWidthInches : "—";
  return `${num} · ${w}×${e.sheetLengthInches} in · qty ${e.quantity}`;
}
