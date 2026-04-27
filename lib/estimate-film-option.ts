import type { FilmStockKind } from "@prisma/client";

/**
 * Film roll row as used on the new estimate form (matches /api/film-inventory list items).
 */
export type FilmOption = {
  id: string;
  rollWidth: number;
  thicknessMil: number;
  materialType: string;
  materialTypeLabel?: string;
  description: string;
  stockKind: FilmStockKind;
  vendor: string | null;
  remainingLinearFeet: number;
  pricePerFilmSquareInch: number;
};

export function filmOptionLabel(r: FilmOption): string {
  const typeShown = r.materialTypeLabel ?? r.materialType;
  const price = r.pricePerFilmSquareInch.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  const kindTag = r.stockKind === "CATALOG" ? "Catalog · " : "";
  const vendorTag = r.vendor?.trim() ? `${r.vendor.trim()} · ` : "";
  return `${kindTag}${vendorTag}${typeShown} · ${r.description} · ${r.thicknessMil} mil · ${r.rollWidth} in · ${r.remainingLinearFeet} lin. ft · $${price}/MSI`;
}

export function filmOptionSearchText(r: FilmOption): string {
  return [
    r.stockKind,
    r.vendor ?? "",
    r.materialTypeLabel ?? r.materialType,
    r.materialType,
    r.description,
    String(r.rollWidth),
    String(r.thicknessMil),
    String(r.remainingLinearFeet),
    String(r.pricePerFilmSquareInch),
  ]
    .join(" ")
    .toLowerCase();
}
