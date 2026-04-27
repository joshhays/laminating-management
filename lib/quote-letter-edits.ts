const TEXT_KEYS = ["description", "size", "paper", "finishing", "introLine"] as const;

export type QuoteLetterEditKey = (typeof TEXT_KEYS)[number];

export const MAX_QUOTE_PARTS = 25;
export const PART_LABEL_MAX = 200;
export const PART_SHEETS_MAX = 500;

export type QuoteLetterPartLine = {
  /** Short label, e.g. "Cover", "Insert", "Version A". */
  partLabel: string;
  /** Free-text quantity / sheets (e.g. "350" or "350 of 2"). */
  sheets: string;
  priceUsd: number;
};

/** Stored on `Estimate.quoteLetterEdits`. Only fields that differ from auto-generated values are stored. */
export type QuoteLetterEdits = Partial<Record<QuoteLetterEditKey, string>> & {
  quoteParts?: QuoteLetterPartLine[];
  /** Legacy single line (still read when quoteParts absent). */
  quoteSheetsDisplay?: string;
  quoteTotalUsd?: number;
  /** @deprecated Legacy numeric override; read by parseQuoteLetterEdits only. */
  quoteSheetQuantity?: number;
};

export type QuoteLetterContentDefaults = Record<QuoteLetterEditKey, string>;

export type QuoteLetterFormState = QuoteLetterContentDefaults & {
  parts: QuoteLetterPartLine[];
};

const MAX_LEN = 8000;
const SHEETS_DISPLAY_MAX = 500;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function optFiniteUsd(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function clampPartLine(p: unknown): QuoteLetterPartLine | null {
  if (!isRecord(p)) return null;
  const partLabel = typeof p.partLabel === "string" ? p.partLabel.slice(0, PART_LABEL_MAX) : "";
  const sheets = typeof p.sheets === "string" ? p.sheets.slice(0, PART_SHEETS_MAX) : "";
  const priceUsd =
    typeof p.priceUsd === "number" && Number.isFinite(p.priceUsd) ? Math.max(0, p.priceUsd) : 0;
  return { partLabel, sheets, priceUsd };
}

export function sanitizeQuotePartsArray(raw: unknown): QuoteLetterPartLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: QuoteLetterPartLine[] = [];
  for (const item of raw.slice(0, MAX_QUOTE_PARTS)) {
    const line = clampPartLine(item);
    if (line) out.push(line);
  }
  return out.length > 0 ? out : null;
}

export function quoteLetterPartsTotalUsd(parts: QuoteLetterPartLine[]): number {
  return parts.reduce((s, p) => s + (Number.isFinite(p.priceUsd) ? Math.max(0, p.priceUsd) : 0), 0);
}

function partsDeepEqual(a: QuoteLetterPartLine[], b: QuoteLetterPartLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].partLabel !== b[i].partLabel || a[i].sheets !== b[i].sheets) return false;
    if (Math.abs(a[i].priceUsd - b[i].priceUsd) > 1e-6) return false;
  }
  return true;
}

function hasLegacySingleLineEdits(edits: QuoteLetterEdits | null): boolean {
  if (!edits) return false;
  if (typeof edits.quoteSheetsDisplay === "string") return true;
  if (typeof edits.quoteTotalUsd === "number" && Number.isFinite(edits.quoteTotalUsd)) return true;
  if (typeof edits.quoteSheetQuantity === "number" && Number.isFinite(edits.quoteSheetQuantity)) return true;
  return false;
}

function legacySheetsString(edits: QuoteLetterEdits, defaults: QuoteLetterFormState): string {
  if (typeof edits.quoteSheetsDisplay === "string") return edits.quoteSheetsDisplay;
  if (typeof edits.quoteSheetQuantity === "number" && Number.isFinite(edits.quoteSheetQuantity)) {
    return String(Math.max(0, Math.floor(edits.quoteSheetQuantity)));
  }
  return defaults.parts[0]?.sheets ?? "";
}

function legacyPriceUsd(edits: QuoteLetterEdits, defaults: QuoteLetterFormState): number {
  if (typeof edits.quoteTotalUsd === "number" && Number.isFinite(edits.quoteTotalUsd)) {
    return Math.max(0, edits.quoteTotalUsd);
  }
  return defaults.parts[0]?.priceUsd ?? 0;
}

/** Normalize JSON from DB into a safe edits object (unknown keys dropped). */
export function parseQuoteLetterEdits(raw: unknown): QuoteLetterEdits | null {
  if (raw == null) return null;
  if (!isRecord(raw)) return null;
  const out: QuoteLetterEdits = {};
  for (const k of TEXT_KEYS) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (typeof v !== "string") continue;
    out[k] = v.slice(0, MAX_LEN);
  }
  const parts = sanitizeQuotePartsArray(raw.quoteParts);
  if (parts) out.quoteParts = parts;
  if (typeof raw.quoteSheetsDisplay === "string") {
    out.quoteSheetsDisplay = raw.quoteSheetsDisplay.slice(0, SHEETS_DISPLAY_MAX);
  } else if (typeof raw.quoteSheetQuantity === "number" && Number.isFinite(raw.quoteSheetQuantity)) {
    out.quoteSheetsDisplay = String(Math.max(0, Math.floor(raw.quoteSheetQuantity)));
  }
  const qu = optFiniteUsd(raw.quoteTotalUsd);
  if (qu != null) out.quoteTotalUsd = qu;
  return Object.keys(out).length > 0 ? out : null;
}

export function mergeQuoteLetterContent(
  defaults: QuoteLetterContentDefaults,
  edits: QuoteLetterEdits | null,
): QuoteLetterContentDefaults {
  if (!edits) return { ...defaults };
  return {
    description: typeof edits.description === "string" ? edits.description : defaults.description,
    size: typeof edits.size === "string" ? edits.size : defaults.size,
    paper: typeof edits.paper === "string" ? edits.paper : defaults.paper,
    finishing: typeof edits.finishing === "string" ? edits.finishing : defaults.finishing,
    introLine: typeof edits.introLine === "string" ? edits.introLine : defaults.introLine,
  };
}

export function mergeQuoteLetterForm(
  defaults: QuoteLetterFormState,
  edits: QuoteLetterEdits | null,
): QuoteLetterFormState {
  const text = mergeQuoteLetterContent(defaults, edits);
  let parts: QuoteLetterPartLine[];

  if (edits?.quoteParts && edits.quoteParts.length > 0) {
    parts = edits.quoteParts.map((p) => ({
      partLabel: p.partLabel.slice(0, PART_LABEL_MAX),
      sheets: p.sheets.slice(0, PART_SHEETS_MAX),
      priceUsd: Math.max(0, Number.isFinite(p.priceUsd) ? p.priceUsd : 0),
    }));
  } else if (hasLegacySingleLineEdits(edits) && edits) {
    parts = [
      {
        partLabel: "",
        sheets: legacySheetsString(edits, defaults),
        priceUsd: legacyPriceUsd(edits, defaults),
      },
    ];
  } else {
    parts = defaults.parts.map((p) => ({ ...p }));
  }

  return { ...text, parts };
}

/** Build JSON to persist: only keys that differ from defaults; null → clear overrides. */
export function buildPersistedQuoteLetterEdits(
  current: QuoteLetterFormState,
  defaults: QuoteLetterFormState,
): QuoteLetterEdits | null {
  const out: QuoteLetterEdits = {};
  for (const k of TEXT_KEYS) {
    if (current[k] !== defaults[k]) {
      out[k] = current[k].slice(0, MAX_LEN);
    }
  }
  if (!partsDeepEqual(current.parts, defaults.parts)) {
    out.quoteParts = current.parts.map((p) => ({
      partLabel: p.partLabel.slice(0, PART_LABEL_MAX),
      sheets: p.sheets.slice(0, PART_SHEETS_MAX),
      priceUsd: p.priceUsd,
    }));
  }
  return Object.keys(out).length > 0 ? out : null;
}
