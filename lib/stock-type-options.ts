/** Preset values aligned with `Paper Reference/PaperRef.csv` “Paper Grade” column. */
export const PAPER_GRADE_STOCK_VALUES = [
  "Uncoated Offset / Text",
  "Coated Text (Gloss)",
  "Coated Text (Dull/Matte)",
  "Uncoated Cover",
  "Coated Cover (Gloss)",
  "Coated Cover (Dull/Matte)",
] as const;

export type PaperGradeStockValue = (typeof PAPER_GRADE_STOCK_VALUES)[number];

const PAPER_GRADE_SET = new Set<string>(PAPER_GRADE_STOCK_VALUES);

export function isPresetPaperGradeStock(stockType: string): boolean {
  return PAPER_GRADE_SET.has(stockType.trim());
}

/** Speed rule presets: wildcard plus paper grades (custom text still allowed in rules UI). */
export const STOCK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "*", label: "Any stock (*)" },
  ...PAPER_GRADE_STOCK_VALUES.map((v) => ({ value: v, label: v })),
];

/** Estimates use the six paper grades; “Custom…” is a separate UI path. */
export const ESTIMATE_STOCK_TYPE_OPTIONS = PAPER_GRADE_STOCK_VALUES.map((v) => ({
  value: v,
  label: v,
}));
