import { prisma } from "@/lib/prisma";

/** Seeded when the options table is empty (legacy enum equivalents). */
export const DEFAULT_FILM_MATERIAL_TYPES: {
  code: string;
  label: string;
  sortOrder: number;
}[] = [
  { code: "PET", label: "PET", sortOrder: 0 },
  { code: "PP", label: "Polypropylene (PP)", sortOrder: 1 },
  { code: "PVC", label: "PVC", sortOrder: 2 },
  { code: "NYLON", label: "Nylon", sortOrder: 3 },
  { code: "BOPP", label: "BOPP", sortOrder: 4 },
  { code: "CAST_PP", label: "Cast PP", sortOrder: 5 },
  { code: "OTHER", label: "Other", sortOrder: 6 },
];

export async function ensureFilmMaterialTypeDefaults(): Promise<void> {
  const count = await prisma.filmMaterialTypeOption.count();
  if (count > 0) return;
  await prisma.filmMaterialTypeOption.createMany({
    data: DEFAULT_FILM_MATERIAL_TYPES.map((d) => ({
      code: d.code,
      label: d.label,
      sortOrder: d.sortOrder,
      active: true,
    })),
  });
}

export async function getFilmMaterialLabelMap(): Promise<Map<string, string>> {
  await ensureFilmMaterialTypeDefaults();
  const rows = await prisma.filmMaterialTypeOption.findMany();
  return new Map(rows.map((r) => [r.code, r.label]));
}

export async function getActiveFilmMaterialCodes(): Promise<Set<string>> {
  await ensureFilmMaterialTypeDefaults();
  const rows = await prisma.filmMaterialTypeOption.findMany({
    where: { active: true },
    select: { code: true },
  });
  return new Set(rows.map((r) => r.code));
}

/** New rolls / PO lines: must be an active code. */
export async function isActiveFilmMaterialCode(code: string): Promise<boolean> {
  const active = await getActiveFilmMaterialCodes();
  return active.has(code);
}

/** Existing roll edits: any defined code (including inactive) is allowed. */
export async function isKnownFilmMaterialCode(code: string): Promise<boolean> {
  await ensureFilmMaterialTypeDefaults();
  const row = await prisma.filmMaterialTypeOption.findUnique({
    where: { code },
    select: { code: true },
  });
  return row != null;
}

export function normalizeFilmMaterialCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function collectUsedFilmMaterialCodes(): Promise<Set<string>> {
  const [fromRolls, fromLines] = await Promise.all([
    prisma.filmInventory.findMany({ select: { materialType: true } }),
    prisma.purchaseOrderLine.findMany({ select: { materialType: true } }),
  ]);
  const s = new Set<string>();
  for (const r of fromRolls) s.add(r.materialType);
  for (const r of fromLines) s.add(r.materialType);
  return s;
}
