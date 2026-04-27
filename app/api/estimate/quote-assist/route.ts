import { NextResponse } from "next/server";
import type { FilmCandidate } from "@/lib/quote-assist-film";
import { isRollFeasibleForSheet } from "@/lib/quote-assist-film";
import { parseQuoteIntent } from "@/lib/quote-assist-parse";
import {
  formatOrientationComparisonUsd,
  pickBestLaminationOrientation,
} from "@/lib/quote-assist-orientation";
import type {
  QuoteAssistErrorResponse,
  QuoteAssistPatch,
  QuoteAssistResponse,
} from "@/lib/quote-assist-types";
import { prisma } from "@/lib/prisma";
import { LAMINATE_WIDTH_INSET_INCHES } from "@/lib/estimate-math";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 8) {
      return NextResponse.json({
        ok: false,
        error: "Describe the job in a sentence or two (sheet size, qty, paper, film style).",
      } satisfies QuoteAssistErrorResponse as QuoteAssistErrorResponse, { status: 400 });
    }

    const intent = await parseQuoteIntent(text);

    if (intent.sheetWidthInches == null || intent.sheetLengthInches == null) {
      return NextResponse.json({
        ok: false,
        error:
          "Could not infer sheet size in inches. Include something like 19x25 or 18.5 x 12 for parent sheet width × length.",
        hints: [
          "Example: 2500 sheets 19x25 coated cover gloss, matte PET laminate both sides",
        ],
      } satisfies QuoteAssistErrorResponse as QuoteAssistErrorResponse, { status: 400 });
    }

    const films = (await prisma.filmInventory.findMany({
      orderBy: { createdAt: "desc" },
    })) as FilmCandidate[];
    if (films.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No film rolls in inventory. Add rolls under Inventory → Film stock first.",
      } satisfies QuoteAssistErrorResponse as QuoteAssistErrorResponse, { status: 400 });
    }

    const qtyCompare = Math.max(1, Math.min(1_000_000, intent.quantity ?? 100));

    const pick = pickBestLaminationOrientation({
      sheetWidthInches: intent.sheetWidthInches,
      sheetLengthInches: intent.sheetLengthInches,
      films,
      keywords: intent.filmKeywords,
      quantityForCompare: qtyCompare,
      preference: intent.laminationFeedHint,
    });

    if (!pick) {
      const w = intent.sheetWidthInches;
      const l = intent.sheetLengthInches;
      const sm = Math.min(w, l);
      const lg = Math.max(w, l);
      const lamNarrow = sm - LAMINATE_WIDTH_INSET_INCHES;
      const lamWide = lg - LAMINATE_WIDTH_INSET_INCHES;
      const feasNarrow = films.some((f) => isRollFeasibleForSheet(f.rollWidth, sm));
      const feasWide = films.some((f) => isRollFeasibleForSheet(f.rollWidth, lg));
      return NextResponse.json({
        ok: false,
        error: `No roll fits either run direction for this sheet. Long-edge lead needs ~${lamNarrow.toFixed(2)} in laminate width (${sm}" web); short-edge lead needs ~${lamWide.toFixed(2)} in (${lg}" web). Narrow feasible: ${feasNarrow ? "yes" : "no"}; wide feasible: ${feasWide ? "yes" : "no"}.`,
        hints: [
          "Add a roll at least as wide as the laminate width for one orientation, with ≥ ½ in slit trim when the roll is wider.",
        ],
      } satisfies QuoteAssistErrorResponse as QuoteAssistErrorResponse, { status: 400 });
    }

    const { best, preferenceFallback, evaluated } = pick;
    const chosen = best.chosen;
    const ranked = best.ranked;

    const patch: QuoteAssistPatch = {
      filmId: chosen.id,
      materialWidthInches: String(best.orientation.materialWidthInches),
      sheetLengthInches: String(best.orientation.sheetLengthInches),
    };

    if (intent.quantity != null && intent.quantity > 0) {
      patch.quantity = String(Math.floor(intent.quantity));
    }
    if (intent.finalWidthInches != null) {
      patch.finalSheetWidthInches = String(intent.finalWidthInches);
    }
    if (intent.finalLengthInches != null) {
      patch.finalSheetLengthInches = String(intent.finalLengthInches);
    }
    if (intent.paperDescription?.trim()) {
      patch.paperDescription = intent.paperDescription.trim();
    }
    if (intent.stockType) {
      patch.stockType = intent.stockType;
    }
    if (intent.printProcess) {
      patch.printProcess = intent.printProcess;
    }
    if (intent.secondPassEnabled === true) {
      patch.secondPassEnabled = true;
    }

    const alt = ranked
      .slice(1, 4)
      .map((f) => `${f.description} (${f.rollWidth}" web)`)
      .join("; ");

    const orientLines: string[] = [];
    if (evaluated.length > 1) {
      for (const ev of evaluated) {
        const mark = ev === best ? "→ chosen" : "";
        orientLines.push(
          `${ev.orientation.label}: ${formatOrientationComparisonUsd(ev, qtyCompare)} ${mark}`.trim(),
        );
      }
    } else {
      orientLines.push(
        `${best.orientation.label} (${formatOrientationComparisonUsd(best, qtyCompare)}).`,
      );
    }

    const explanation = [
      evaluated.length > 1
        ? `Compared both feed directions for ${intent.sheetWidthInches}×${intent.sheetLengthInches}" parent sheet.`
        : null,
      orientLines.join(" "),
      preferenceFallback
        ? "Your stated feed preference wasn’t workable with current rolls — picked the feasible orientation with lowest film cost / slit waste."
        : null,
      `Selected roll: ${chosen.description} (${chosen.rollWidth} in web, ${chosen.materialType}).`,
      ranked.length > 1 && alt ? `Alternates: ${alt}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const orientationSummary = [
      best.orientation.label,
      evaluated.length > 1
        ? `Also scored: ${evaluated
            .filter((e) => e !== best)
            .map((e) => e.orientation.tag.replace(/_/g, " "))
            .join(", ")}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    const warnings: string[] = [];
    if (intent.quantity == null) {
      warnings.push("Set a sheet quantity — none was detected.");
    }
    if (preferenceFallback) {
      warnings.push("Feed hint was adjusted because the preferred orientation had no fitting film.");
    }
    if (!process.env.OPENAI_API_KEY) {
      warnings.push(
        "Tip: set OPENAI_API_KEY for smarter reading of casual notes; otherwise pattern matching is used.",
      );
    }

    const response: QuoteAssistResponse = {
      ok: true,
      patch,
      explanation,
      orientationSummary,
      filmMatchNote: `Keywords used: ${intent.filmKeywords.slice(0, 12).join(", ") || "(none — tightest feasible roll)"}; feed hint: ${intent.laminationFeedHint.replace(/_/g, " ")}.`,
      warnings: warnings.length ? warnings : undefined,
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not build a suggestion." } as QuoteAssistErrorResponse,
      { status: 400 },
    );
  }
}
