import type { FilmStockKind } from "@prisma/client";
import { LAMINATE_WIDTH_INSET_INCHES, MIN_SLIT_STRIP_WIDTH_INCHES } from "@/lib/estimate-math";

export type FilmCandidate = {
  id: string;
  rollWidth: number;
  thicknessMil: number;
  materialType: string;
  description: string;
  stockKind?: FilmStockKind;
  remainingLinearFeet: number;
  pricePerFilmSquareInch: number;
};

/**
 * True if this roll width can laminate this sheet width (cross-web) per shop slit rules.
 * @param laminateWidthInsetInches Total cross-web bare margin (default {@link LAMINATE_WIDTH_INSET_INCHES}).
 */
export function isRollFeasibleForSheet(
  rollWidthInches: number,
  materialWidthInches: number,
  laminateWidthInsetInches: number = LAMINATE_WIDTH_INSET_INCHES,
): boolean {
  const laminateWidthInches = materialWidthInches - laminateWidthInsetInches;
  if (!Number.isFinite(laminateWidthInches) || laminateWidthInches <= 0) return false;
  if (rollWidthInches + 1e-9 < laminateWidthInches) return false;
  const slitExcessWidthInches = Math.max(0, rollWidthInches - laminateWidthInches);
  if (
    slitExcessWidthInches > 0 &&
    slitExcessWidthInches + 1e-9 < MIN_SLIT_STRIP_WIDTH_INCHES
  ) {
    return false;
  }
  return true;
}

/**
 * Rank feasible rolls: keyword match on type + description, then tightest web (least slit waste),
 * then more footage on hand.
 */
export function rankFilmRollsForSheet(
  films: FilmCandidate[],
  materialWidthInches: number,
  keywords: string[],
  laminateWidthInsetInches: number = LAMINATE_WIDTH_INSET_INCHES,
): { ranked: FilmCandidate[]; chosen: FilmCandidate | null } {
  const laminateWidthInches = materialWidthInches - laminateWidthInsetInches;
  const feasible = films.filter((f) =>
    isRollFeasibleForSheet(f.rollWidth, materialWidthInches, laminateWidthInsetInches),
  );
  if (feasible.length === 0) {
    return { ranked: [], chosen: null };
  }

  const kw = keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length >= 2);

  const scored = feasible.map((f) => {
    const slit = Math.max(0, f.rollWidth - laminateWidthInches);
    let keywordScore = 0;
    const blob = `${f.materialType} ${f.description}`.toLowerCase();
    for (const k of kw) {
      if (blob.includes(k)) keywordScore += 20;
    }
    if (kw.length === 0) keywordScore = 5;
    const tightness = -slit;
    const stock = f.remainingLinearFeet;
    return {
      film: f,
      keywordScore,
      tightness,
      stock,
    };
  });

  scored.sort((a, b) => {
    if (b.keywordScore !== a.keywordScore) return b.keywordScore - a.keywordScore;
    if (b.tightness !== a.tightness) return b.tightness - a.tightness;
    if (b.stock !== a.stock) return b.stock - a.stock;
    const af = a.film.stockKind === "FLOOR_STOCK" ? 1 : 0;
    const bf = b.film.stockKind === "FLOOR_STOCK" ? 1 : 0;
    return bf - af;
  });

  const ranked = scored.map((s) => s.film);
  return { ranked, chosen: ranked[0] ?? null };
}
