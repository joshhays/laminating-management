import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildQuoteLetterFormDefaults,
  buildQuoteLetterFormDefaultsForBundle,
  quoteLetterDisplayNumber,
  type EstimateForQuoteLetter,
} from "@/lib/quote-letter-content";
import { parseQuoteLetterEdits } from "@/lib/quote-letter-edits";
import { prisma } from "@/lib/prisma";
import { getShopQuoteBoilerplate } from "@/lib/shop-quote-settings";
import { QuoteLetterShell } from "./quote-letter-shell";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const estimateQuoteLetterInclude = {
  filmRoll: true,
  secondFilmRoll: true,
  company: true,
  contact: true,
  lines: { orderBy: { sortOrder: "asc" as const } },
  estimateBundle: true,
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    select: {
      id: true,
      estimateNumber: true,
      bundleId: true,
      estimateBundle: { select: { quoteNumber: true } },
    },
  });
  const num = quoteLetterDisplayNumber(
    estimate ?? { id, estimateNumber: null, bundleId: null },
    estimate?.estimateBundle ?? null,
  );
  return {
    title: `Quotation ${num}`,
  };
}

export default async function QuoteLetterPage({ params }: PageProps) {
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: estimateQuoteLetterInclude,
  });

  if (!estimate) notFound();

  let bundleMembers: EstimateForQuoteLetter[];
  if (estimate.bundleId) {
    const rows = await prisma.estimate.findMany({
      where: { bundleId: estimate.bundleId },
      include: {
        filmRoll: true,
        secondFilmRoll: true,
        lines: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { bundleSortOrder: "asc" },
    });
    bundleMembers = rows as EstimateForQuoteLetter[];
  } else {
    bundleMembers = [estimate as EstimateForQuoteLetter];
  }

  const shop = getShopQuoteBoilerplate();
  const quoteNo = quoteLetterDisplayNumber(estimate, estimate.estimateBundle);

  const quoteCompanyName =
    estimate.quoteCompanyName ?? estimate.company?.name ?? null;
  const quoteCompanyAddress =
    estimate.quoteCompanyAddress ?? estimate.company?.address ?? null;
  const quoteContactName =
    estimate.quoteContactName ??
    (estimate.contact
      ? `${estimate.contact.firstName} ${estimate.contact.lastName}`.trim()
      : null);

  const quoteDate = new Date(estimate.updatedAt).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });

  const defaults =
    bundleMembers.length > 1
      ? buildQuoteLetterFormDefaultsForBundle(bundleMembers, shop.introLine)
      : buildQuoteLetterFormDefaults(estimate as EstimateForQuoteLetter, shop.introLine);

  const savedEdits =
    estimate.bundleId && estimate.estimateBundle
      ? parseQuoteLetterEdits(estimate.estimateBundle.quoteLetterEdits)
      : parseQuoteLetterEdits(estimate.quoteLetterEdits);

  const accountingReviewRequired =
    estimate.bundleId && estimate.estimateBundle
      ? estimate.estimateBundle.accountingReviewRequired
      : estimate.accountingReviewRequired;

  const quantityLabel = "Sheets (order qty)";

  return (
    <QuoteLetterShell
      estimate={{
        id: estimate.id,
        quoteNo,
        quoteDate,
        quoteCompanyName,
        quoteCompanyAddress,
        quoteContactName,
        accountingReviewRequired,
        quantityLabel,
      }}
      shop={shop}
      defaults={defaults}
      savedEdits={savedEdits}
    />
  );
}
