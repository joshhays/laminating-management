/**
 * CSV helpers for film inventory export/import.
 * Format: header row, then one row per roll. Fields may be quoted (RFC 4180-style).
 */

import type { FilmStockKind } from "@prisma/client";
import { parseFilmStockKindFromCsvCell } from "@/lib/film-stock-kind";

export const FILM_INVENTORY_CSV_HEADERS = [
  "id",
  "rollWidth",
  "thicknessMil",
  "materialType",
  "description",
  "stockKind",
  "vendor",
  "remainingLinearFeet",
  "pricePerFilmSquareInch",
] as const;

export type FilmInventoryCsvRow = {
  id?: string;
  rollWidth: number;
  thicknessMil: number;
  materialType: string;
  description: string;
  stockKind: FilmStockKind;
  vendor: string | null;
  remainingLinearFeet: number;
  pricePerFilmSquareInch: number;
};

export function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Parse CSV text into rows (array of string columns). Handles quoted fields. */
export function parseCsvToRows(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"') {
      if (inQuotes && t[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "") || row.length > 1) {
        rows.push(row);
      }
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "") || row.length > 1) {
      rows.push(row);
    }
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

/** Map canonical column names to CSV column index. `id` is optional. */
export function mapFilmInventoryHeaderIndices(headerRow: string[]): Map<string, number> {
  const aliases: Record<string, string> = {
    id: "id",
    rollwidth: "rollWidth",
    thicknessmil: "thicknessMil",
    materialtype: "materialType",
    description: "description",
    stockkind: "stockKind",
    stocktype: "stockKind",
    itemkind: "stockKind",
    vendor: "vendor",
    supplier: "vendor",
    remaininglinearfeet: "remainingLinearFeet",
    priceperfilmsquareinch: "pricePerFilmSquareInch",
    pricepermaterialsquareinch: "pricePerFilmSquareInch",
  };
  const m = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = normalizeHeader(h);
    const canon = aliases[key];
    if (canon) m.set(canon, i);
  });
  return m;
}

export function parseFilmInventoryCsvRows(
  rows: string[][],
): { ok: true; data: FilmInventoryCsvRow[] } | { ok: false; error: string } {
  if (rows.length < 2) {
    return { ok: false, error: "CSV must include a header row and at least one data row." };
  }
  const headerIdx = mapFilmInventoryHeaderIndices(rows[0]);
  const required = [
    "rollWidth",
    "thicknessMil",
    "materialType",
    "description",
    "remainingLinearFeet",
    "pricePerFilmSquareInch",
  ] as const;
  for (const name of required) {
    if (!headerIdx.has(name)) {
      return {
        ok: false,
        error: `Missing column "${name}". Expected header: ${FILM_INVENTORY_CSV_HEADERS.join(",")}`,
      };
    }
  }
  const data: FilmInventoryCsvRow[] = [];
  const seenIds = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    if (line.every((c) => !String(c ?? "").trim())) continue;
    const get = (name: string) => {
      const idx = headerIdx.get(name);
      if (idx === undefined) return "";
      return (line[idx] ?? "").trim();
    };
    const idRaw = get("id");
    if (idRaw && seenIds.has(idRaw)) {
      return { ok: false, error: `Duplicate id "${idRaw}" in import file (row ${r + 1}).` };
    }
    if (idRaw) seenIds.add(idRaw);

    const rollWidth = Number(get("rollWidth"));
    const thicknessMil = Number(get("thicknessMil"));
    const materialType = get("materialType");
    const description = get("description");
    const remainingLinearFeet = Number(get("remainingLinearFeet"));
    const pricePerFilmSquareInch = Number(get("pricePerFilmSquareInch"));
    const stockKindRaw = headerIdx.has("stockKind") ? get("stockKind") : "";
    const sk = parseFilmStockKindFromCsvCell(stockKindRaw);
    if (!sk.ok) {
      return { ok: false, error: `Row ${r + 1}: ${sk.message}` };
    }
    const vendorRaw = headerIdx.has("vendor") ? get("vendor").trim() : "";
    const vendor = vendorRaw ? vendorRaw : null;

    if (![rollWidth, thicknessMil, remainingLinearFeet, pricePerFilmSquareInch].every(
      (n) => Number.isFinite(n) && n >= 0,
    )) {
      return {
        ok: false,
        error: `Row ${r + 1}: rollWidth, thicknessMil, remainingLinearFeet, and pricePerFilmSquareInch must be non-negative numbers.`,
      };
    }
    if (!description) {
      return { ok: false, error: `Row ${r + 1}: description is required.` };
    }
    if (!materialType) {
      return { ok: false, error: `Row ${r + 1}: materialType is required.` };
    }

    const row: FilmInventoryCsvRow = {
      rollWidth,
      thicknessMil,
      materialType,
      description,
      stockKind: sk.value,
      vendor,
      remainingLinearFeet,
      pricePerFilmSquareInch,
    };
    if (idRaw) row.id = idRaw;
    data.push(row);
  }
  if (data.length === 0) {
    return { ok: false, error: "No data rows in CSV (after skipping blank lines)." };
  }
  return { ok: true, data };
}

export function parseFilmInventoryCsvText(text: string) {
  const rows = parseCsvToRows(text);
  return parseFilmInventoryCsvRows(rows);
}

export function filmInventoryRowsToCsv(
  rows: Array<{
    id: string;
    rollWidth: number;
    thicknessMil: number;
    materialType: string;
    description: string;
    stockKind: FilmStockKind;
    vendor: string | null;
    remainingLinearFeet: number;
    pricePerFilmSquareInch: number;
  }>,
): string {
  const header = FILM_INVENTORY_CSV_HEADERS.join(",");
  const lines = rows.map((r) =>
    [
      csvEscapeCell(r.id),
      csvEscapeCell(String(r.rollWidth)),
      csvEscapeCell(String(r.thicknessMil)),
      csvEscapeCell(r.materialType),
      csvEscapeCell(r.description),
      csvEscapeCell(r.stockKind),
      csvEscapeCell(r.vendor ?? ""),
      csvEscapeCell(String(r.remainingLinearFeet)),
      csvEscapeCell(String(r.pricePerFilmSquareInch)),
    ].join(","),
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}
