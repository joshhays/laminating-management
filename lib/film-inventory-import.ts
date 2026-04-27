import type { FilmInventoryCsvRow } from "@/lib/film-inventory-csv";
import {
  isActiveFilmMaterialCode,
  isKnownFilmMaterialCode,
  normalizeFilmMaterialCode,
} from "@/lib/film-material-service";
import { prisma } from "@/lib/prisma";

export type FilmInventoryImportResult = {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
};

/**
 * Upsert film rolls from CSV rows: existing `id` updates; missing/unknown `id` creates.
 */
export async function applyFilmInventoryImport(
  rows: FilmInventoryCsvRow[],
): Promise<FilmInventoryImportResult> {
  const result: FilmInventoryImportResult = { created: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const materialType = normalizeFilmMaterialCode(r.materialType);
    const description = r.description.trim();

    try {
      const id = r.id?.trim();

      if (id) {
        const existing = await prisma.filmInventory.findUnique({ where: { id } });
        if (existing) {
          if (!(await isKnownFilmMaterialCode(materialType))) {
            result.errors.push({
              row: rowNum,
              message: `Unknown material type "${materialType}" — add it under Material types first.`,
            });
            continue;
          }
          await prisma.filmInventory.update({
            where: { id },
            data: {
              rollWidth: r.rollWidth,
              thicknessMil: r.thicknessMil,
              materialType,
              description,
              stockKind: r.stockKind,
              vendor: r.vendor,
              remainingLinearFeet: r.remainingLinearFeet,
              pricePerFilmSquareInch: r.pricePerFilmSquareInch,
            },
          });
          result.updated++;
        } else {
          if (!(await isActiveFilmMaterialCode(materialType))) {
            result.errors.push({
              row: rowNum,
              message: `Invalid or inactive material type "${materialType}" — add or enable it under Material types.`,
            });
            continue;
          }
          await prisma.filmInventory.create({
            data: {
              rollWidth: r.rollWidth,
              thicknessMil: r.thicknessMil,
              materialType,
              description,
              stockKind: r.stockKind,
              vendor: r.vendor,
              remainingLinearFeet: r.remainingLinearFeet,
              pricePerFilmSquareInch: r.pricePerFilmSquareInch,
            },
          });
          result.created++;
        }
      } else {
        if (!(await isActiveFilmMaterialCode(materialType))) {
          result.errors.push({
            row: rowNum,
            message: `Invalid or inactive material type "${materialType}" — add or enable it under Material types.`,
          });
          continue;
        }
        await prisma.filmInventory.create({
          data: {
            rollWidth: r.rollWidth,
            thicknessMil: r.thicknessMil,
            materialType,
            description,
            stockKind: r.stockKind,
            vendor: r.vendor,
            remainingLinearFeet: r.remainingLinearFeet,
            pricePerFilmSquareInch: r.pricePerFilmSquareInch,
          },
        });
        result.created++;
      }
    } catch (e) {
      result.errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : "Could not save row",
      });
    }
  }

  return result;
}
