import { LB_COVER_TO_GSM, LB_TEXT_TO_GSM } from "@/lib/print-scheduler/sheet-format";

/**
 * Best-effort GSM from substrate / stock description lines on a ticket.
 */
export function estimateGsmFromStockDescription(
  stockDescription: string | null | undefined,
): number | null {
  if (!stockDescription) return null;
  const s = stockDescription.replace(/\s+/g, " ").trim();
  if (!s) return null;

  const gsmDirect = s.match(/\b(\d{2,4})\s*(?:gsm|g\s*\/\s*m2)\b/i);
  if (gsmDirect) {
    const n = Number(gsmDirect[1]);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  const coverLb = s.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|#)\.?\s*cover\b/i);
  if (coverLb) {
    const lb = Number(coverLb[1]);
    if (Number.isFinite(lb)) return Math.round(lb * LB_COVER_TO_GSM * 10) / 10;
  }

  const textLb = s.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|#)\.?\s*text\b/i);
  if (textLb) {
    const lb = Number(textLb[1]);
    if (Number.isFinite(lb)) return Math.round(lb * LB_TEXT_TO_GSM * 10) / 10;
  }

  const hashCover = s.match(/\b(\d+(?:\.\d+)?)\s*#\s*cover\b/i);
  if (hashCover) {
    const lb = Number(hashCover[1]);
    if (Number.isFinite(lb)) return Math.round(lb * LB_COVER_TO_GSM * 10) / 10;
  }

  const hashText = s.match(/\b(\d+(?:\.\d+)?)\s*#\s*text\b/i);
  if (hashText) {
    const lb = Number(hashText[1]);
    if (Number.isFinite(lb)) return Math.round(lb * LB_TEXT_TO_GSM * 10) / 10;
  }

  return null;
}

const DUPLEX_HINT =
  /\b(duplex|duplexed|two[-\s]?sid(ed|es)|2[-\s]?sid(ed|es)|double[-\s]?sid(ed|es)|perfecting|tumbled)\b/i;

/**
 * Infer duplex from raw ticket text (job jacket body).
 */
export function inferDuplexFromTicketText(
  rawPdfText: string | null | undefined,
): boolean | null {
  if (!rawPdfText || !rawPdfText.trim()) return null;
  const head = rawPdfText.slice(0, 12_000);
  return DUPLEX_HINT.test(head) ? true : null;
}
