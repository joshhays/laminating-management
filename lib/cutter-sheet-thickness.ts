import {
  lookupCaliperInches,
  lookupCaliperInchesFromRefForPt,
  parseLooseBasisLb,
  type PaperRefRow,
} from "@/lib/paper-ref";
import {
  basisKindFromEstimatePaperGrade,
  parsePaperSpecificationToGsm,
} from "@/lib/paper-spec-to-gsm";

export type CutterThicknessResolve =
  | { ok: true; inches: number; source: "paper_ref" | "paper_ref_pt" | "manual" }
  | { ok: false; error: string };

/** Substrate caliper for cutter lifts: PaperRef “Caliper (Inches)” via basis lb or caliper (pt) row, else optional manual. */
export function resolveCutterSheetThicknessInches(params: {
  stockType: string;
  paperDescription: string;
  paperRefRows: PaperRefRow[];
  manualInches: number | null;
  paperCaliperPt?: number | null;
}): CutterThicknessResolve {
  const { stockType, paperDescription, paperRefRows, manualInches, paperCaliperPt } = params;
  const hint = basisKindFromEstimatePaperGrade(stockType);
  const parsed = parsePaperSpecificationToGsm(
    paperDescription,
    hint ? { basisKindHint: hint } : undefined,
  );
  const basisLb = parsed.basisLb ?? parseLooseBasisLb(paperDescription);

  const pt = paperCaliperPt ?? null;
  const thicknessFromPtField = pt != null && pt > 0;
  if (thicknessFromPtField) {
    const calFromRef = lookupCaliperInchesFromRefForPt(stockType, pt, paperRefRows);
    if (calFromRef != null && Number.isFinite(calFromRef) && calFromRef > 0) {
      return { ok: true, inches: calFromRef, source: "paper_ref_pt" };
    }
  }

  if (basisLb != null && basisLb > 0) {
    const cal = lookupCaliperInches(stockType, basisLb, paperRefRows);
    if (cal != null && Number.isFinite(cal) && cal > 0) {
      return { ok: true, inches: cal, source: "paper_ref" };
    }
  }

  if (manualInches != null && Number.isFinite(manualInches) && manualInches > 0) {
    return { ok: true, inches: manualInches, source: "manual" };
  }

  return {
    ok: false,
    error:
      "Could not find substrate caliper in PaperRef.csv for this stock: match caliper (pt) or basis weight (# / lb) to the ref table’s thickness, or enter sheet thickness manually.",
  };
}
