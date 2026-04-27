import type { Estimate, EstimateBundle, EstimateLine, FilmInventory } from "@prisma/client";
import type { QuoteLetterContentDefaults, QuoteLetterFormState } from "@/lib/quote-letter-edits";

export type EstimateForQuoteLetter = Estimate & {
  filmRoll: FilmInventory | null;
  secondFilmRoll: FilmInventory | null;
  lines?: EstimateLine[];
};

export function quoteLetterDisplayNumber(
  estimate: Pick<Estimate, "estimateNumber" | "id" | "bundleId">,
  bundle?: Pick<EstimateBundle, "quoteNumber"> | null,
): string {
  if (bundle?.quoteNumber != null) {
    return String(bundle.quoteNumber);
  }
  if (estimate.estimateNumber != null) {
    return String(estimate.estimateNumber);
  }
  return estimate.id.slice(-8).toUpperCase();
}

function formatEstimateSheetsDisplayForLetter(e: EstimateForQuoteLetter): string {
  const fromDb =
    e.lines && e.lines.length > 0
      ? [...e.lines].sort((a, b) => a.sortOrder - b.sortOrder)
      : null;
  if (fromDb && fromDb.length > 0) {
    return fromDb
      .map((l) => {
        const q = l.quantity.toLocaleString();
        const lab = l.label?.trim();
        return lab ? `${q} (${lab})` : q;
      })
      .join("; ");
  }
  return Math.max(0, Math.floor(Number(e.quantity))).toLocaleString();
}

/** Stacked specs + one pricing row per bundle member (each estimate is a full separate run). */
export function buildQuoteLetterFormDefaultsForBundle(
  estimates: EstimateForQuoteLetter[],
  shopIntroLine: string,
): QuoteLetterFormState {
  const sep = "\n\n—\n\n";
  return {
    description: estimates.map((e) => buildQuoteDescriptionLine(e)).join(sep),
    size: estimates.map((e) => buildQuoteSizeLine(e)).join(sep),
    paper: estimates.map((e) => buildQuotePaperLine(e)).join(sep),
    finishing: estimates.map((e) => buildQuoteFinishingLine(e)).join(sep),
    introLine: shopIntroLine,
    parts: estimates.map((e, i) => {
      const label =
        e.bundlePartLabel?.trim() || (estimates.length > 1 ? `Part ${i + 1}` : "");
      const price = Math.max(0, Number.isFinite(e.totalCost) ? e.totalCost : 0);
      return {
        partLabel: label,
        sheets: formatEstimateSheetsDisplayForLetter(e),
        priceUsd: price,
      };
    }),
  };
}

export function buildQuoteDescriptionLine(estimate: EstimateForQuoteLetter): string {
  const parts = [estimate.filmType?.trim()].filter(Boolean);
  if (estimate.estimatedCutCount && estimate.estimatedCutCount > 0) {
    parts.push("trim");
  }
  return parts.join(" + ") || "—";
}

export function buildQuoteSizeLine(estimate: EstimateForQuoteLetter): string {
  const flatW = estimate.materialWidthInches;
  const flatL = estimate.sheetLengthInches;
  const finalW = estimate.finalSheetWidthInches;
  const finalL = estimate.finalSheetLengthInches;

  const flat =
    flatW != null && Number.isFinite(flatW) && flatL != null && Number.isFinite(flatL)
      ? `${flatW} × ${flatL}`
      : estimate.sheetSize?.trim() || "—";

  if (finalW != null && finalL != null && Number.isFinite(finalW) && Number.isFinite(finalL)) {
    const finalStr = `${finalW} × ${finalL}`;
    return `Flat: ${flat}    Final: ${finalStr}`;
  }
  return `Flat: ${flat}`;
}

export function buildQuotePaperLine(estimate: EstimateForQuoteLetter): string {
  const stock = estimate.stockType?.trim();
  const paper = estimate.paperDescription?.trim();
  const gsm =
    estimate.paperGsm != null && Number.isFinite(estimate.paperGsm)
      ? `${estimate.paperGsm} gsm`
      : null;
  const chunks = [stock, paper, gsm].filter(Boolean);
  return chunks.length > 0 ? chunks.join(" · ") : "—";
}

function sentenceCase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function buildQuoteFinishingLine(estimate: EstimateForQuoteLetter): string {
  const parts: string[] = [];

  const film = estimate.filmType?.trim();
  if (film) {
    if (estimate.passCount > 1) {
      parts.push(`two-sided lamination with ${film}`);
    } else {
      parts.push(`laminate with ${film}`);
    }
  }

  const fw = estimate.finalSheetWidthInches;
  const fl = estimate.finalSheetLengthInches;
  if (fw != null && fl != null && Number.isFinite(fw) && Number.isFinite(fl)) {
    parts.push(`trim to final size (${fw} × ${fl} in)`);
  }

  if (estimate.skidPackEnabled) {
    parts.push("skid pack");
  }

  if (estimate.includesFinalDelivery) {
    const note = estimate.finalDeliveryNotes?.trim();
    parts.push(note ? `final delivery (${note})` : "final delivery");
  } else {
    parts.push("customer pick up");
  }

  if (parts.length === 0) return "—";
  return sentenceCase(parts.join(", ") + ".");
}

export function formatCurrencyUsd(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function buildQuoteLetterContentDefaults(
  estimate: EstimateForQuoteLetter,
  shopIntroLine: string,
): QuoteLetterContentDefaults {
  return {
    description: buildQuoteDescriptionLine(estimate),
    size: buildQuoteSizeLine(estimate),
    paper: buildQuotePaperLine(estimate),
    finishing: buildQuoteFinishingLine(estimate),
    introLine: shopIntroLine,
  };
}

export function buildQuoteLetterFormDefaults(
  estimate: EstimateForQuoteLetter,
  shopIntroLine: string,
): QuoteLetterFormState {
  const total = Math.max(0, Number.isFinite(estimate.totalCost) ? estimate.totalCost : 0);
  const fromDb =
    estimate.lines && estimate.lines.length > 0
      ? [...estimate.lines].sort((a, b) => a.sortOrder - b.sortOrder)
      : null;
  if (fromDb && fromDb.length > 0) {
    return {
      ...buildQuoteLetterContentDefaults(estimate, shopIntroLine),
      parts: fromDb.map((l) => ({
        partLabel: l.label,
        sheets: l.quantity.toLocaleString(),
        priceUsd: l.allocatedCostUsd,
      })),
    };
  }
  const qty = Math.max(0, Math.floor(Number(estimate.quantity)));
  return {
    ...buildQuoteLetterContentDefaults(estimate, shopIntroLine),
    parts: [{ partLabel: "", sheets: qty.toLocaleString(), priceUsd: total }],
  };
}
