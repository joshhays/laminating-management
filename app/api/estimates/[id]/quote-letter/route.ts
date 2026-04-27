import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  buildQuoteLetterFormDefaults,
  buildQuoteLetterFormDefaultsForBundle,
  type EstimateForQuoteLetter,
} from "@/lib/quote-letter-content";
import {
  MAX_QUOTE_PARTS,
  PART_LABEL_MAX,
  PART_SHEETS_MAX,
  buildPersistedQuoteLetterEdits,
  type QuoteLetterFormState,
  type QuoteLetterPartLine,
} from "@/lib/quote-letter-edits";
import { getShopQuoteBoilerplate } from "@/lib/shop-quote-settings";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseParts(body: unknown): QuoteLetterPartLine[] | "invalid" {
  if (!Array.isArray(body) || body.length === 0) return "invalid";
  const parts: QuoteLetterPartLine[] = [];
  for (const item of body.slice(0, MAX_QUOTE_PARTS)) {
    if (!isRecord(item)) return "invalid";
    const partLabel =
      typeof item.partLabel === "string" ? item.partLabel.slice(0, PART_LABEL_MAX) : "";
    const sheets = typeof item.sheets === "string" ? item.sheets.slice(0, PART_SHEETS_MAX) : "";
    if (typeof item.priceUsd !== "number" || !Number.isFinite(item.priceUsd) || item.priceUsd < 0) {
      return "invalid";
    }
    parts.push({ partLabel, sheets, priceUsd: item.priceUsd });
  }
  return parts.length > 0 ? parts : "invalid";
}

function parseForm(body: unknown): QuoteLetterFormState | "invalid" {
  if (!isRecord(body) || !isRecord(body.lines)) return "invalid";
  const L = body.lines;
  const keys = ["description", "size", "paper", "finishing", "introLine"] as const;
  const text = {} as QuoteLetterFormState;
  for (const k of keys) {
    const v = L[k];
    if (typeof v !== "string") return "invalid";
    text[k] = v.slice(0, 8000);
  }
  const parts = parseParts(body.parts);
  if (parts === "invalid") return "invalid";
  text.parts = parts;
  return text;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const form = parseForm(body);
  if (form === "invalid") {
    return NextResponse.json(
      {
        error:
          "Expected body.lines (description, size, paper, finishing, introLine) and parts: [{ partLabel, sheets, priceUsd }, ...]",
      },
      { status: 400 },
    );
  }

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      filmRoll: true,
      secondFilmRoll: true,
      estimateBundle: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const shop = getShopQuoteBoilerplate();

  if (estimate.bundleId && estimate.estimateBundle) {
    const bundleRows = await prisma.estimate.findMany({
      where: { bundleId: estimate.bundleId },
      include: {
        filmRoll: true,
        secondFilmRoll: true,
        lines: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { bundleSortOrder: "asc" },
    });
    const defaults =
      bundleRows.length > 1
        ? buildQuoteLetterFormDefaultsForBundle(bundleRows as EstimateForQuoteLetter[], shop.introLine)
        : buildQuoteLetterFormDefaults(bundleRows[0] as EstimateForQuoteLetter, shop.introLine);
    const persisted = buildPersistedQuoteLetterEdits(form, defaults);

    await prisma.estimateBundle.update({
      where: { id: estimate.bundleId },
      data: {
        quoteLetterEdits: persisted === null ? Prisma.DbNull : (persisted as Prisma.InputJsonValue),
      },
    });

    return NextResponse.json({ ok: true, quoteLetterEdits: persisted });
  }

  const defaults = buildQuoteLetterFormDefaults(
    estimate as EstimateForQuoteLetter,
    shop.introLine,
  );
  const persisted = buildPersistedQuoteLetterEdits(form, defaults);

  await prisma.estimate.update({
    where: { id },
    data: {
      quoteLetterEdits: persisted === null ? Prisma.DbNull : (persisted as Prisma.InputJsonValue),
    },
  });

  return NextResponse.json({ ok: true, quoteLetterEdits: persisted });
}
