import type { LaminationFeedPreference } from "@/lib/quote-assist-orientation";
import { PAPER_GRADE_STOCK_VALUES } from "@/lib/stock-type-options";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "need",
  "want",
  "quote",
  "job",
  "run",
  "print",
  "sheet",
  "sheets",
  "inch",
  "inches",
  "laminate",
  "lamination",
  "film",
  "roll",
  "size",
  "about",
  "around",
  "like",
  "some",
]);

export type ParsedQuoteIntent = {
  quantity: number | null;
  sheetWidthInches: number | null;
  sheetLengthInches: number | null;
  finalWidthInches: number | null;
  finalLengthInches: number | null;
  paperDescription: string | null;
  stockType: string | null;
  printProcess: "Offset" | "Digital" | null;
  secondPassEnabled: boolean | null;
  filmKeywords: string[];
  /** How to map parent sheet dimensions to cross-web vs feed when both are possible. */
  laminationFeedHint: LaminationFeedPreference;
};

function tokenizeForKeywords(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return [...new Set(raw)];
}

function extractDimensions(text: string): { w: number; l: number } | null {
  const re = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/gi;
  const matches = [...text.matchAll(re)];
  for (const m of matches) {
    const w = Number(m[1]);
    const l = Number(m[2]);
    if (
      Number.isFinite(w) &&
      Number.isFinite(l) &&
      w >= 3 &&
      w <= 130 &&
      l >= 3 &&
      l <= 200
    ) {
      return { w, l };
    }
  }
  return null;
}

function extractQuantity(text: string): number | null {
  const m1 = text.match(/\b(\d{1,7})\s*(?:sheets?|pcs|pieces)\b/i);
  if (m1) return Number(m1[1]);
  const m2 = text.match(/\b(?:qty|quantity|run\s+of|order\s+of)\s*[:=]?\s*(\d{1,7})\b/i);
  if (m2) return Number(m2[1]);
  const m3 = text.match(/\b(\d{1,7})\s*(?:sheets?|pcs)\b/i);
  if (m3) return Number(m3[1]);
  return null;
}

function extractFinalTrim(text: string): { w: number; l: number } | null {
  const m = text.match(
    /\b(?:trim|trimmed|finished|final)\s*(?:to|at|size)?\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\b/i,
  );
  if (!m) return null;
  const w = Number(m[1]);
  const l = Number(m[2]);
  if (w >= 1 && w <= 120 && l >= 1 && l <= 200) return { w, l };
  return null;
}

function guessStockType(text: string): string | null {
  const low = text.toLowerCase();
  for (const v of PAPER_GRADE_STOCK_VALUES) {
    const vl = v.toLowerCase();
    if (low.includes(vl)) return v;
    const first = vl.split(/[,\s]/)[0];
    if (first && first.length > 4 && low.includes(first)) return v;
  }
  if (/\b12pt\b|\b12\s*pt\b/.test(low) && low.includes("cover")) {
    return "Coated Cover (Gloss)";
  }
  if (/\b100\s*#|100lb|100lb text/.test(low)) {
    return "Coated Text (Gloss)";
  }
  if (/\b80\s*#|80lb/.test(low) && low.includes("text")) {
    return "Coated Text (Dull/Matte)";
  }
  return null;
}

function guessPrintProcess(text: string): "Offset" | "Digital" | null {
  const low = text.toLowerCase();
  if (/\bdigital\b/.test(low)) return "Digital";
  if (/\boffset\b/.test(low)) return "Offset";
  return null;
}

function normalizeLaminationFeedHint(
  raw: string | null | undefined,
): LaminationFeedPreference | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (t === "long_edge_lead" || t === "long_edge" || t === "long") return "long_edge_lead";
  if (t === "short_edge_lead" || t === "short_edge" || t === "short") return "short_edge_lead";
  if (t === "optimize" || t === "auto" || t === "best") return "optimize";
  return null;
}

/** e.g. "25 inch web" / "18.5\" cross-web" → which lead matches that cross-web width. */
function inferFeedFromCrossWebText(
  text: string,
  w: number,
  l: number,
): LaminationFeedPreference | null {
  const low = text.toLowerCase();
  const re =
    /\b(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)\s+(?:web|cross(?:[-\s]?)web)\b/gi;
  let m: RegExpExecArray | null;
  let best: LaminationFeedPreference | null = null;
  const sm = Math.min(w, l);
  const lg = Math.max(w, l);
  while ((m = re.exec(low)) != null) {
    const want = Number(m[1]);
    if (!Number.isFinite(want)) continue;
    if (Math.abs(want - sm) <= 0.75) best = "long_edge_lead";
    else if (Math.abs(want - lg) <= 0.75) best = "short_edge_lead";
  }
  return best;
}

function guessLaminationFeedFromPhrases(text: string): LaminationFeedPreference | null {
  const low = text.toLowerCase();
  if (/\boptimize\b|\beither\s+way\b|\bbest\s+(path|way|orientation|feed)\b/.test(low)) {
    return "optimize";
  }
  if (
    /\bshort\s+edge\b|\bshort-edge\b|\blead\s+(?:with\s+)?short\b|\bshort\s+lead\b|\bfeed\s+(?:the\s+)?short\b/.test(
      low,
    )
  ) {
    return "short_edge_lead";
  }
  if (
    /\blong\s+edge\b|\blong-edge\b|\blead\s+(?:with\s+)?long\b|\blong\s+lead\b|\bfeed\s+(?:the\s+)?long\b/.test(
      low,
    )
  ) {
    return "long_edge_lead";
  }
  return null;
}

function guessSecondPass(text: string): boolean | null {
  const low = text.toLowerCase();
  if (/\b(both sides|two sides|double-sided|2\s*sides|second pass|two pass|duplex)\b/.test(low)) {
    return true;
  }
  return null;
}

/** Heuristic parse when no LLM is available. */
export function parseQuoteIntentFallback(text: string): ParsedQuoteIntent {
  const trimmed = text.trim();
  const dims = extractDimensions(trimmed);
  const finalTrim = extractFinalTrim(trimmed);
  const qty = extractQuantity(trimmed);
  const filmKeywords = tokenizeForKeywords(trimmed);

  const dimsW = dims?.w ?? null;
  const dimsL = dims?.l ?? null;
  const fromPhrases = guessLaminationFeedFromPhrases(trimmed);
  const fromWeb =
    dimsW != null && dimsL != null ? inferFeedFromCrossWebText(trimmed, dimsW, dimsL) : null;

  return {
    quantity: qty,
    sheetWidthInches: dimsW,
    sheetLengthInches: dimsL,
    finalWidthInches: finalTrim?.w ?? null,
    finalLengthInches: finalTrim?.l ?? null,
    paperDescription: trimmed.length > 0 ? trimmed.slice(0, 500) : null,
    stockType: guessStockType(trimmed),
    printProcess: guessPrintProcess(trimmed),
    secondPassEnabled: guessSecondPass(trimmed),
    filmKeywords,
    laminationFeedHint: fromWeb ?? fromPhrases ?? "optimize",
  };
}

type OpenAiExtract = {
  quantity?: number | null;
  sheetWidthInches?: number | null;
  sheetLengthInches?: number | null;
  finalWidthInches?: number | null;
  finalLengthInches?: number | null;
  paperDescription?: string | null;
  stockType?: string | null;
  printProcess?: string | null;
  secondPassEnabled?: boolean | null;
  filmKeywords?: string[] | null;
  laminationFeedHint?: string | null;
};

export async function parseQuoteIntentWithOpenAI(
  text: string,
): Promise<Partial<ParsedQuoteIntent> | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;

  const model = process.env.OPENAI_QUOTE_ASSIST_MODEL ?? "gpt-4o-mini";
  const stockList = PAPER_GRADE_STOCK_VALUES.join(" | ");

  const system = `You extract structured fields for a print shop laminate quote from casual user text.
Return JSON only with keys:
- quantity (integer or null)
- sheetWidthInches (number or null, inches, cross-web width of parent sheet)
- sheetLengthInches (number or null, inches, feed direction along press)
- finalWidthInches (number or null, inches, finished trim width if mentioned)
- finalLengthInches (number or null, inches, finished trim length if mentioned)
- paperDescription (short string, substrate summary, or null)
- stockType (exactly one of: ${stockList} — or null if unknown)
- printProcess ("Offset" or "Digital" or null)
- secondPassEnabled (boolean, true if two-sided lamination or two passes mentioned, else null)
- filmKeywords (array of short words to match film inventory: e.g. matte gloss PET BOPP 1 mil 3 mil)

If the user gives sizes like "19x25" assume inches as parent sheet dimensions (first × second); do not assume which edge leads — use laminationFeedHint.
laminationFeedHint MUST be one of:
- "long_edge_lead" — cross-web (film width) is the SHORTER parent dimension; feed direction is the longer (typical long-edge-first).
- "short_edge_lead" — cross-web is the LONGER dimension; feed is the shorter (short-edge lead / wide web).
- "optimize" — choose between the two using inventory and economy (default when user does not specify).

Examples: 19×25 sheet, long_edge_lead → cross-web 19", feed 25". short_edge_lead → cross-web 25", feed 19".
If the user says "25 inch web" or "18.5 cross-web", set laminationFeedHint to match that geometry (short_edge vs long_edge as appropriate).

If ambiguous, prefer reasonable commercial print sizes and laminationFeedHint "optimize".`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text.slice(0, 8000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpenAiExtract;
    const out: Partial<ParsedQuoteIntent> = {};
    if (parsed.quantity != null && Number.isFinite(Number(parsed.quantity))) {
      out.quantity = Math.floor(Number(parsed.quantity));
    }
    for (const [k, dest] of [
      ["sheetWidthInches", "sheetWidthInches"],
      ["sheetLengthInches", "sheetLengthInches"],
      ["finalWidthInches", "finalWidthInches"],
      ["finalLengthInches", "finalLengthInches"],
    ] as const) {
      const v = parsed[k as keyof OpenAiExtract];
      if (v != null && Number.isFinite(Number(v))) {
        (out as Record<string, number>)[dest] = Number(v);
      }
    }
    if (typeof parsed.paperDescription === "string" && parsed.paperDescription.trim()) {
      out.paperDescription = parsed.paperDescription.trim().slice(0, 500);
    }
    if (typeof parsed.stockType === "string") {
      const st = parsed.stockType.trim();
      if (PAPER_GRADE_STOCK_VALUES.includes(st as (typeof PAPER_GRADE_STOCK_VALUES)[number])) {
        out.stockType = st;
      }
    }
    if (parsed.printProcess === "Offset" || parsed.printProcess === "Digital") {
      out.printProcess = parsed.printProcess;
    }
    if (typeof parsed.secondPassEnabled === "boolean") {
      out.secondPassEnabled = parsed.secondPassEnabled;
    }
    if (Array.isArray(parsed.filmKeywords)) {
      out.filmKeywords = parsed.filmKeywords
        .map((x) => String(x).trim().toLowerCase())
        .filter((x) => x.length >= 2);
    }
    if (typeof parsed.laminationFeedHint === "string") {
      const norm = normalizeLaminationFeedHint(parsed.laminationFeedHint);
      if (norm) out.laminationFeedHint = norm;
    }
    return out;
  } catch {
    return null;
  }
}

async function mergeIntent(
  text: string,
  fallback: ParsedQuoteIntent,
  ai: Partial<ParsedQuoteIntent> | null,
): Promise<ParsedQuoteIntent> {
  const merged: ParsedQuoteIntent = {
    quantity: ai?.quantity ?? fallback.quantity,
    sheetWidthInches: ai?.sheetWidthInches ?? fallback.sheetWidthInches,
    sheetLengthInches: ai?.sheetLengthInches ?? fallback.sheetLengthInches,
    finalWidthInches: ai?.finalWidthInches ?? fallback.finalWidthInches,
    finalLengthInches: ai?.finalLengthInches ?? fallback.finalLengthInches,
    paperDescription: ai?.paperDescription ?? fallback.paperDescription,
    stockType: ai?.stockType ?? fallback.stockType,
    printProcess: ai?.printProcess ?? fallback.printProcess,
    secondPassEnabled:
      ai?.secondPassEnabled !== undefined && ai?.secondPassEnabled !== null
        ? ai.secondPassEnabled
        : fallback.secondPassEnabled,
    filmKeywords:
      ai?.filmKeywords && ai.filmKeywords.length > 0
        ? [...new Set([...ai.filmKeywords, ...fallback.filmKeywords])]
        : fallback.filmKeywords,
    laminationFeedHint:
      fallback.laminationFeedHint !== "optimize"
        ? fallback.laminationFeedHint
        : (ai?.laminationFeedHint ?? "optimize"),
  };

  if (merged.sheetWidthInches == null && merged.sheetLengthInches == null) {
    const fb = extractDimensions(text);
    if (fb) {
      merged.sheetWidthInches = fb.w;
      merged.sheetLengthInches = fb.l;
    }
  }
  if (merged.quantity == null) {
    const q = extractQuantity(text);
    if (q != null) merged.quantity = q;
  }

  if (
    merged.sheetWidthInches != null &&
    merged.sheetLengthInches != null &&
    merged.laminationFeedHint === "optimize"
  ) {
    const fromWeb = inferFeedFromCrossWebText(
      text,
      merged.sheetWidthInches,
      merged.sheetLengthInches,
    );
    const fromPhrase = guessLaminationFeedFromPhrases(text);
    if (fromWeb != null) merged.laminationFeedHint = fromWeb;
    else if (fromPhrase != null && fromPhrase !== "optimize") merged.laminationFeedHint = fromPhrase;
  }

  return merged;
}

export async function parseQuoteIntent(text: string): Promise<ParsedQuoteIntent> {
  const fallback = parseQuoteIntentFallback(text);
  const ai = await parseQuoteIntentWithOpenAI(text);
  return await mergeIntent(text, fallback, ai);
}
