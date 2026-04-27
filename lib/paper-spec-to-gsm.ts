/**
 * Derive metric GSM from common US paper callouts (e.g. "100# Coated Cover", "80 lb text")
 * using standard 500-sheet basis sizes. Used for machine speed / slowdown rules that key on GSM.
 *
 * References: TAPPI / common US trade basis sheets (cover 20×26, text/book 25×38, etc.)
 */

const SQ_IN_TO_SQ_M = 0.0254 * 0.0254;
const GRAMS_PER_LB = 453.59237;

/** Parent sheet size (inches) for 500-sheet US basis weights. */
export const BASIS_SHEETS_INCHES = {
  cover: [20, 26] as const,
  text: [25, 38] as const,
  bristol: [22.5, 28.5] as const,
  index: [25.5, 30.5] as const,
  tag: [24, 36] as const,
} as const;

export type BasisKind = keyof typeof BASIS_SHEETS_INCHES;

export type PaperSpecParseResult = {
  gsm: number | null;
  method: "basis_weight" | "gsm_literal" | "pt_approximate" | "none";
  /** When method is basis_weight */
  basisKind?: BasisKind;
  basisWidthIn?: number;
  basisHeightIn?: number;
  basisLb?: number;
  /** Human-readable note for UI */
  detail?: string;
};

export type ParsePaperSpecOptions = {
  /** When the description omits “text” / “cover”, use the estimate “Stock category” row. */
  basisKindHint?: BasisKind;
};

/**
 * Maps estimate paper-grade dropdown values to US basis parent-sheet kind for # / lb → GSM.
 */
export function basisKindFromEstimatePaperGrade(grade: string): BasisKind | null {
  const g = grade.trim();
  if (!g) return null;
  if (/\bcover\b/i.test(g)) return "cover";
  if (/\btext\b/i.test(g) || /offset\s*\/\s*text/i.test(g)) return "text";
  return null;
}

function lbOnBasisToGsm(lb: number, widthIn: number, heightIn: number): number {
  const areaSqM = widthIn * heightIn * SQ_IN_TO_SQ_M;
  const gramsPerSheet = (lb / 500) * GRAMS_PER_LB;
  return gramsPerSheet / areaSqM;
}

function roundGsm(n: number): number {
  return Math.round(n * 10) / 10;
}

/** US 500-sheet basis: text/book 25×38 in, cover 20×26 in. */
export function usBasisLbToGsm(lb: number, basisKind: "text" | "cover"): number {
  const [w, h] = BASIS_SHEETS_INCHES[basisKind];
  return roundGsm(lbOnBasisToGsm(lb, w, h));
}

export type PaperSurfaceFinish = "coated" | "uncoated" | "C1S" | "C2S";

export function composePaperDescriptionFromFields(opts: {
  basisLb: number;
  basisKind: "text" | "cover";
  finish: PaperSurfaceFinish;
  extraNotes?: string;
}): string {
  const { basisLb, basisKind, finish, extraNotes } = opts;
  const kindWord = basisKind === "text" ? "text" : "cover";
  const mid =
    finish === "C1S" ? "C1S" : finish === "C2S" ? "C2S" : finish === "uncoated" ? "uncoated" : "coated";
  let s = `${basisLb} lb ${mid} ${kindWord}`;
  if (extraNotes?.trim()) s = `${s} — ${extraNotes.trim()}`;
  return s;
}

/**
 * Mass of one rectangular sheet from grammage (g/m²).
 * weight_g = GSM × width_m × length_m
 */
export function sheetWeightFromGsm(
  gsm: number,
  widthInches: number,
  lengthInches: number,
): { grams: number; lbs: number } | null {
  if (!Number.isFinite(gsm) || gsm <= 0) return null;
  if (!Number.isFinite(widthInches) || !Number.isFinite(lengthInches)) return null;
  if (widthInches <= 0 || lengthInches <= 0) return null;
  const wM = widthInches * 0.0254;
  const hM = lengthInches * 0.0254;
  const grams = gsm * wM * hM;
  const lbs = grams / GRAMS_PER_LB;
  return { grams, lbs };
}

/**
 * Best-effort parse of a saved paper line back into structured fields (for prefill).
 */
export function tryExtractStructuredPaperFromSpec(spec: string): {
  basisLb: string;
  basisKind: "text" | "cover";
  finish: PaperSurfaceFinish;
  extraNotes: string;
} | null {
  const raw = spec.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const basisMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:#|lb|lbs)\b/);
  if (!basisMatch) return null;
  const lbStr = basisMatch[1]!;
  const kind = detectBasisKind(lower);
  if (kind !== "text" && kind !== "cover") return null;

  let finish: PaperSurfaceFinish = "coated";
  if (/\bc2s\b/i.test(raw)) finish = "C2S";
  else if (/\bc1s\b/i.test(raw)) finish = "C1S";
  else if (/\buncoated\b/i.test(lower)) finish = "uncoated";
  else if (/\bcoated\b/i.test(lower)) finish = "coated";

  return { basisLb: lbStr, basisKind: kind, finish, extraNotes: "" };
}

/**
 * Pick US basis grade from free text. Order matters (more specific first).
 */
function detectBasisKind(lower: string): BasisKind | null {
  if (
    /\bcover\b/.test(lower) ||
    /\bc1s\b/.test(lower) ||
    /\bc2s\b/.test(lower) ||
    /\bduotone\b/.test(lower) ||
    (/\bboard\b/.test(lower) && !/\bchip\s*board\b/.test(lower))
  ) {
    return "cover";
  }
  if (/\bbristol\b/.test(lower)) return "bristol";
  if (/\bindex\b/.test(lower)) return "index";
  if (/\btag\b/.test(lower)) return "tag";
  if (
    /\btext\b/.test(lower) ||
    /\bbook\b/.test(lower) ||
    /\bbond\b/.test(lower) ||
    /\bwriting\b/.test(lower) ||
    /\bopaque\b/.test(lower) ||
    /\boffset\b/.test(lower) ||
    /\bvellum\b/.test(lower)
  ) {
    return "text";
  }
  return null;
}

/**
 * Parse strings like "100# Coated Cover", "80 lb gloss text", "270 gsm", "12 pt C2S".
 */
export function parsePaperSpecificationToGsm(
  spec: string,
  opts?: ParsePaperSpecOptions,
): PaperSpecParseResult {
  const raw = spec.trim();
  if (!raw) {
    return { gsm: null, method: "none" };
  }

  const lower = raw.toLowerCase();

  const gsmLiteral =
    lower.match(/\b(\d+(?:\.\d+)?)\s*g\s*\/\s*m\s*2\b/) ||
    lower.match(/\b(\d+(?:\.\d+)?)\s*gsm\b/);
  if (gsmLiteral) {
    const n = Number(gsmLiteral[1]);
    if (Number.isFinite(n) && n > 0 && n < 2000) {
      return {
        gsm: roundGsm(n),
        method: "gsm_literal",
        detail: "Entered as GSM",
      };
    }
  }

  const basisMatch = lower.match(
    /(\d+(?:\.\d+)?)\s*(?:#|lb|lbs|\bpounds?\b)\b/,
  );
  if (basisMatch) {
    const lb = Number(basisMatch[1]);
    if (Number.isFinite(lb) && lb > 0 && lb <= 500) {
      let kind = detectBasisKind(lower);
      if (kind == null && opts?.basisKindHint) {
        kind = opts.basisKindHint;
      }
      if (kind) {
        const [w, h] = BASIS_SHEETS_INCHES[kind];
        const gsm = roundGsm(lbOnBasisToGsm(lb, w, h));
        return {
          gsm,
          method: "basis_weight",
          basisKind: kind,
          basisWidthIn: w,
          basisHeightIn: h,
          basisLb: lb,
          detail: `${lb} lb ${kind} basis (${w}×${h} in parent sheet)`,
        };
      }
      return {
        gsm: null,
        method: "none",
        detail: `Add text vs cover (or book/bristol) so basis size is known — e.g. "${lb} lb coated text" or "${lb}# cover".`,
      };
    }
  }

  const ptMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*pt\b/);
  if (ptMatch) {
    const pt = Number(ptMatch[1]);
    if (Number.isFinite(pt) && pt > 0 && pt <= 48) {
      const gsm = roundGsm(pt * 22);
      return {
        gsm,
        method: "pt_approximate",
        detail: `~${gsm} GSM from ${pt} pt (rule-of-thumb; caliper varies by sheet)`,
      };
    }
  }

  return {
    gsm: null,
    method: "none",
    detail: "Add a # or lb grade (e.g. 100# Cover) or a GSM value",
  };
}
