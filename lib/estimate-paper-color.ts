import { EstimatePaperColor } from "@prisma/client";

export const ESTIMATE_PAPER_COLOR_OPTIONS = [
  { value: EstimatePaperColor.WHITE, label: "White" },
  { value: EstimatePaperColor.COLORED, label: "Colored" },
] as const;

export function labelEstimatePaperColor(c: EstimatePaperColor): string {
  return c === EstimatePaperColor.COLORED ? "Colored" : "White";
}

/** API / form: default missing → WHITE; reject unknown. */
export function parseEstimatePaperColorInput(raw: unknown): EstimatePaperColor | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return EstimatePaperColor.WHITE;
  }
  const s = String(raw).trim().toUpperCase();
  if (s === "WHITE") return EstimatePaperColor.WHITE;
  if (s === "COLORED") return EstimatePaperColor.COLORED;
  return null;
}

/** Speed rule row: "", "*", null → wildcard. */
export function parseSpeedRulePaperColorInput(
  raw: unknown,
): EstimatePaperColor | "invalid" | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "" || s === "*") return null;
  const u = s.toUpperCase();
  if (u === "WHITE") return EstimatePaperColor.WHITE;
  if (u === "COLORED") return EstimatePaperColor.COLORED;
  return "invalid";
}
