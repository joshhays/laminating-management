import type { FilmStockKind } from "@prisma/client";

const VALID = new Set<string>(["FLOOR_STOCK", "CATALOG"]);

/** Returns `undefined` when the field is omitted or blank (use default). */
export function parseOptionalFilmStockKind(raw: unknown): FilmStockKind | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim().toUpperCase();
  if (!s) return undefined;
  return VALID.has(s) ? (s as FilmStockKind) : undefined;
}

export function defaultFilmStockKind(): FilmStockKind {
  return "FLOOR_STOCK";
}

export function normalizeVendorInput(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw).trim();
  return t ? t : null;
}

/** CSV import: empty → FLOOR_STOCK; allows friendly aliases. */
export function parseFilmStockKindFromCsvCell(
  raw: string,
): { ok: true; value: FilmStockKind } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: "FLOOR_STOCK" };
  const u = t.toUpperCase().replace(/\s+/g, "_");
  if (
    u === "FLOOR_STOCK" ||
    u === "FLOOR" ||
    u === "ON_FLOOR" ||
    u === "ONFLOOR" ||
    u === "INVENTORY" ||
    u === "STOCK"
  ) {
    return { ok: true, value: "FLOOR_STOCK" };
  }
  if (u === "CATALOG" || u === "CATALOG_ONLY" || u === "JOB_ORDER") {
    return { ok: true, value: "CATALOG" };
  }
  return { ok: false, message: `Invalid stockKind "${t}" (use FLOOR_STOCK or CATALOG).` };
}
