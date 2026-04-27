import { computeEstimateMetrics, type EstimateMetrics } from "@/lib/estimate-math";

export type FilmRollInput = {
  rollWidth: number;
  pricePerFilmSquareInch: number;
};

export type AggregatedFilmEstimate = {
  primary: EstimateMetrics;
  secondPass: EstimateMetrics | null;
  totalCostFromFilm: number;
  totalFilmFromRollSquareInches: number;
  totalLaminateFilmSquareInches: number;
  totalSlitWasteSquareInches: number;
  totalMaterialSquareInches: number;
};

/**
 * One or two passes; second pass may use the same roll (double consumption) or a different roll.
 */
export function aggregateFilmForEstimate(input: {
  productionQuantity: number;
  sheetLengthInches: number;
  materialWidthInches: number;
  firstRoll: FilmRollInput;
  secondPassEnabled: boolean;
  secondFilmSameAsFirst: boolean;
  secondRoll: FilmRollInput | null;
  laminateWidthInsetInches?: number;
}): AggregatedFilmEstimate {
  const sharedInset = { laminateWidthInsetInches: input.laminateWidthInsetInches };
  const primary = computeEstimateMetrics({
    quantity: input.productionQuantity,
    sheetLengthInches: input.sheetLengthInches,
    materialWidthInches: input.materialWidthInches,
    rollWidthInches: input.firstRoll.rollWidth,
    pricePerFilmSquareInch: input.firstRoll.pricePerFilmSquareInch,
    ...sharedInset,
  });

  if (!input.secondPassEnabled) {
    return {
      primary,
      secondPass: null,
      totalCostFromFilm: primary.totalCostFromFilm,
      totalFilmFromRollSquareInches: primary.filmFromRollSquareInches,
      totalLaminateFilmSquareInches: primary.laminateFilmSquareInches,
      totalSlitWasteSquareInches: primary.slitWasteSquareInches,
      totalMaterialSquareInches: primary.materialSquareInches,
    };
  }

  if (input.secondFilmSameAsFirst || input.secondRoll == null) {
    return {
      primary,
      secondPass: null,
      totalCostFromFilm: primary.totalCostFromFilm * 2,
      totalFilmFromRollSquareInches: primary.filmFromRollSquareInches * 2,
      totalLaminateFilmSquareInches: primary.laminateFilmSquareInches * 2,
      totalSlitWasteSquareInches: primary.slitWasteSquareInches * 2,
      totalMaterialSquareInches: primary.materialSquareInches,
    };
  }

  const secondPass = computeEstimateMetrics({
    quantity: input.productionQuantity,
    sheetLengthInches: input.sheetLengthInches,
    materialWidthInches: input.materialWidthInches,
    rollWidthInches: input.secondRoll.rollWidth,
    pricePerFilmSquareInch: input.secondRoll.pricePerFilmSquareInch,
    ...sharedInset,
  });

  return {
    primary,
    secondPass,
    totalCostFromFilm: primary.totalCostFromFilm + secondPass.totalCostFromFilm,
    totalFilmFromRollSquareInches:
      primary.filmFromRollSquareInches + secondPass.filmFromRollSquareInches,
    totalLaminateFilmSquareInches:
      primary.laminateFilmSquareInches + secondPass.laminateFilmSquareInches,
    totalSlitWasteSquareInches: primary.slitWasteSquareInches + secondPass.slitWasteSquareInches,
    totalMaterialSquareInches: primary.materialSquareInches,
  };
}
