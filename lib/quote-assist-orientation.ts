import { computeEstimateMetrics, LAMINATE_WIDTH_INSET_INCHES } from "@/lib/estimate-math";
import type { FilmCandidate } from "@/lib/quote-assist-film";
import { rankFilmRollsForSheet } from "@/lib/quote-assist-film";

/** User / model intent: which edge leads into the press (cross-web is the other dimension). */
export type LaminationFeedPreference = "long_edge_lead" | "short_edge_lead" | "optimize";

export type LaminationOrientation = {
  materialWidthInches: number;
  sheetLengthInches: number;
  /** Human-readable: cross-web × feed */
  label: string;
  /** Machine-oriented tag */
  tag: "long_edge_lead" | "short_edge_lead";
};

function uniqueOrientations(
  w: number,
  l: number,
): { longLead: LaminationOrientation; shortLead: LaminationOrientation } {
  const sm = Math.min(w, l);
  const lg = Math.max(w, l);
  return {
    longLead: {
      materialWidthInches: sm,
      sheetLengthInches: lg,
      label: `${sm}" web × ${lg}" feed (long-edge lead)`,
      tag: "long_edge_lead",
    },
    shortLead: {
      materialWidthInches: lg,
      sheetLengthInches: sm,
      label: `${lg}" web × ${sm}" feed (short-edge lead)`,
      tag: "short_edge_lead",
    },
  };
}

/**
 * Which orientations to score for quote assist.
 */
export function orientationsToEvaluate(
  sheetWidthInches: number,
  sheetLengthInches: number,
  preference: LaminationFeedPreference,
): LaminationOrientation[] {
  const { longLead, shortLead } = uniqueOrientations(sheetWidthInches, sheetLengthInches);
  if (Math.abs(sheetWidthInches - sheetLengthInches) < 1e-6) {
    return [
      {
        materialWidthInches: sheetWidthInches,
        sheetLengthInches: sheetLengthInches,
        label: `${sheetWidthInches}" × ${sheetLengthInches}" (square — one run orientation)`,
        tag: "long_edge_lead",
      },
    ];
  }
  if (preference === "long_edge_lead") return [longLead];
  if (preference === "short_edge_lead") return [shortLead];
  return [longLead, shortLead];
}

export type ScoredOrientation = {
  orientation: LaminationOrientation;
  chosen: FilmCandidate;
  ranked: FilmCandidate[];
  totalCostFromFilm: number;
  slitWasteSquareInches: number;
  filmFromRollSquareInches: number;
  laminateWidthInches: number;
};

function scoreOneOrientation(
  o: LaminationOrientation,
  films: FilmCandidate[],
  keywords: string[],
  quantityForCompare: number,
  laminateWidthInsetInches: number,
): ScoredOrientation | null {
  const { chosen, ranked } = rankFilmRollsForSheet(
    films,
    o.materialWidthInches,
    keywords,
    laminateWidthInsetInches,
  );
  if (!chosen) return null;
  let metrics;
  try {
    metrics = computeEstimateMetrics({
      quantity: Math.max(1, quantityForCompare),
      sheetLengthInches: o.sheetLengthInches,
      materialWidthInches: o.materialWidthInches,
      rollWidthInches: chosen.rollWidth,
      pricePerFilmSquareInch: chosen.pricePerFilmSquareInch,
      laminateWidthInsetInches,
    });
  } catch {
    return null;
  }
  return {
    orientation: o,
    chosen,
    ranked,
    totalCostFromFilm: metrics.totalCostFromFilm,
    slitWasteSquareInches: metrics.slitWasteSquareInches,
    filmFromRollSquareInches: metrics.filmFromRollSquareInches,
    laminateWidthInches: metrics.laminateWidthInches,
  };
}

function compareScored(a: ScoredOrientation, b: ScoredOrientation): number {
  if (a.totalCostFromFilm !== b.totalCostFromFilm) {
    return a.totalCostFromFilm - b.totalCostFromFilm;
  }
  if (a.slitWasteSquareInches !== b.slitWasteSquareInches) {
    return a.slitWasteSquareInches - b.slitWasteSquareInches;
  }
  const slitA = Math.max(0, a.chosen.rollWidth - a.laminateWidthInches);
  const slitB = Math.max(0, b.chosen.rollWidth - b.laminateWidthInches);
  if (slitA !== slitB) return slitA - slitB;
  return a.filmFromRollSquareInches - b.filmFromRollSquareInches;
}

export type OrientationPickResult = {
  best: ScoredOrientation;
  /** Other scored options (e.g. alternate lead), sorted by cost then waste. */
  alternates: ScoredOrientation[];
  /** When preference forced an infeasible path, the workable fallback. */
  preferenceFallback: boolean;
  evaluated: ScoredOrientation[];
};

/**
 * Pick cross-web vs feed using inventory, estimated film $, and slit waste (for `quantityForCompare` sheets).
 */
export function pickBestLaminationOrientation(args: {
  sheetWidthInches: number;
  sheetLengthInches: number;
  films: FilmCandidate[];
  keywords: string[];
  quantityForCompare: number;
  preference: LaminationFeedPreference;
  /** Total cross-web bare margin; defaults to 0.5 in. */
  laminateWidthInsetInches?: number;
}): OrientationPickResult | null {
  const {
    sheetWidthInches,
    sheetLengthInches,
    films,
    keywords,
    quantityForCompare,
    preference,
    laminateWidthInsetInches = LAMINATE_WIDTH_INSET_INCHES,
  } = args;

  const toTry = orientationsToEvaluate(sheetWidthInches, sheetLengthInches, preference);
  const scored: ScoredOrientation[] = [];
  for (const o of toTry) {
    const s = scoreOneOrientation(
      o,
      films,
      keywords,
      quantityForCompare,
      laminateWidthInsetInches,
    );
    if (s) scored.push(s);
  }

  if (scored.length === 0 && preference !== "optimize") {
    const fallbackTry = orientationsToEvaluate(sheetWidthInches, sheetLengthInches, "optimize");
    for (const o of fallbackTry) {
      const s = scoreOneOrientation(
        o,
        films,
        keywords,
        quantityForCompare,
        laminateWidthInsetInches,
      );
      if (s) scored.push(s);
    }
    if (scored.length === 0) return null;
    scored.sort(compareScored);
    const best = scored[0]!;
    return {
      best,
      alternates: scored.slice(1),
      preferenceFallback: true,
      evaluated: scored,
    };
  }

  if (scored.length === 0) return null;

  scored.sort(compareScored);
  const best = scored[0]!;
  return {
    best,
    alternates: scored.slice(1),
    preferenceFallback: false,
    evaluated: scored,
  };
}

export function formatOrientationComparisonUsd(
  s: ScoredOrientation,
  quantityForCompare: number,
): string {
  const perSheet =
    quantityForCompare > 0 ? s.totalCostFromFilm / quantityForCompare : s.totalCostFromFilm;
  return `~$${perSheet.toFixed(2)}/sheet film @ ${quantityForCompare.toLocaleString()} sheets (total film ~$${s.totalCostFromFilm.toFixed(2)})`;
}
