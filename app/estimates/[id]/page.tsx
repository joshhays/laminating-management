import Link from "next/link";
import { notFound } from "next/navigation";
import { estimateFilmMaterialUsdFromRow } from "@/lib/estimate-math";
import { quoteLetterDisplayNumber } from "@/lib/quote-letter-content";
import { prisma } from "@/lib/prisma";
import { formatSheetThicknessInchesLikePaperRef } from "@/lib/paper-ref";
import { labelEstimatePaperColor } from "@/lib/estimate-paper-color";
import { formatSheetsPerHour, sheetsPerHourFromMpm } from "@/lib/sheets-per-hour";
import { ConvertToJobButton } from "./convert-to-job-button";
import { EstimatePrintButton } from "./estimate-print-button";

function jobStatusLabel(s: string) {
  switch (s) {
    case "QUEUED":
      return "queued";
    case "IN_PROGRESS":
      return "in progress";
    case "DONE":
      return "done";
    case "SHIPPED":
      return "shipped";
    default:
      return s.toLowerCase();
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function EstimateDetailPage({ params }: PageProps) {
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      jobTicket: true,
      filmRoll: true,
      secondFilmRoll: true,
      machine: true,
      cutterMachine: true,
      company: true,
      contact: true,
      lines: { orderBy: { sortOrder: "asc" } },
      estimateBundle: true,
    },
  });

  if (!estimate) notFound();

  const bundleSiblings =
    estimate.bundleId != null
      ? await prisma.estimate.findMany({
          where: { bundleId: estimate.bundleId },
          select: {
            id: true,
            bundlePartLabel: true,
            bundleSortOrder: true,
            totalCost: true,
          },
          orderBy: { bundleSortOrder: "asc" },
        })
      : [];

  const displayQuoteNo = quoteLetterDisplayNumber(estimate, estimate.estimateBundle);

  const accountingReviewRequired =
    estimate.estimateBundle != null
      ? estimate.estimateBundle.accountingReviewRequired
      : estimate.accountingReviewRequired;

  const quoteCompanyName =
    estimate.quoteCompanyName ?? estimate.company?.name ?? null;
  const quoteCompanyAddress =
    estimate.quoteCompanyAddress ?? estimate.company?.address ?? null;
  const quoteContactName =
    estimate.quoteContactName ??
    (estimate.contact
      ? `${estimate.contact.firstName} ${estimate.contact.lastName}`.trim()
      : null);
  const quoteContactEmail =
    estimate.quoteContactEmail ?? estimate.contact?.email ?? null;

  const filmMaterialUsd = estimateFilmMaterialUsdFromRow({
    filmFromRollSquareInches: estimate.filmFromRollSquareInches,
    pricePerFilmSquareInch: estimate.pricePerFilmSquareInch,
    totalCost: estimate.totalCost,
    estimatedMachineCost: estimate.estimatedMachineCost,
    estimatedLaborCost: estimate.estimatedLaborCost,
    estimatedCutterCost: estimate.estimatedCutterCost,
    estimatedSkidPackCost: estimate.estimatedSkidPackCost,
    estimatedFinalDeliveryCost: estimate.finalDeliveryCostUsd,
  });

  const savedLineMpm =
    estimate.effectiveLineSpeedMpm != null &&
    Number.isFinite(estimate.effectiveLineSpeedMpm) &&
    estimate.effectiveLineSpeedMpm > 0
      ? estimate.effectiveLineSpeedMpm
      : null;
  const savedSheetsPerHour =
    savedLineMpm != null
      ? sheetsPerHourFromMpm(savedLineMpm, estimate.sheetLengthInches)
      : null;

  const savedAt = new Date(estimate.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="estimate-detail-page mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="mb-8 print:hidden">
        <Link
          href="/estimates"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Estimates
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Estimate</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              {estimate.estimateBundle != null ? (
                <>Quote #{displayQuoteNo}</>
              ) : estimate.estimateNumber != null ? (
                <>#{estimate.estimateNumber}</>
              ) : (
                <span className="font-mono text-xl">{estimate.id}</span>
              )}
            </h1>
            {estimate.bundlePartLabel != null && estimate.bundlePartLabel.trim() !== "" ? (
              <p className="mt-1 text-sm text-zinc-600">Part: {estimate.bundlePartLabel.trim()}</p>
            ) : null}
            {(estimate.estimateNumber != null || estimate.estimateBundle != null) && (
              <p className="mt-1 font-mono text-xs text-zinc-500">Ref {estimate.id}</p>
            )}
            <p className="mt-2 text-xs text-zinc-500">Saved {savedAt}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/estimates/${estimate.id}/quote-letter`}
              className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 print:hidden"
            >
              Quote letter
            </Link>
            <EstimatePrintButton />
          </div>
        </div>
      </header>

      {bundleSiblings.length > 1 ? (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 print:hidden">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Multi-part quote (same letter)
          </p>
          <div className="flex flex-wrap gap-2">
            {bundleSiblings.map((s) => (
              <Link
                key={s.id}
                href={`/estimates/${s.id}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  s.id === estimate.id
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                {(s.bundlePartLabel?.trim() || `Part ${s.bundleSortOrder + 1}`) +
                  ` · $${s.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {accountingReviewRequired ? (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden">
          <p className="font-semibold">Accounting review</p>
          <p className="mt-1">
            This quote was saved over the customer&apos;s credit limit (or policy flagged it at save time).
          </p>
        </div>
      ) : null}

      <div className="estimate-print-root">
        <div className="mb-6 hidden border-b border-zinc-200 pb-4 print:block">
          <h1 className="text-xl font-semibold text-zinc-900">
            {estimate.estimateBundle != null
              ? `Quote #${displayQuoteNo}`
              : estimate.estimateNumber != null
                ? `Estimate #${estimate.estimateNumber}`
                : "Estimate"}
          </h1>
          <p className="mt-1 text-sm text-zinc-700">Saved {savedAt}</p>
          <p className="mt-1 font-mono text-xs text-zinc-500">{estimate.id}</p>
          {accountingReviewRequired ? (
            <p className="mt-3 text-sm font-semibold text-amber-900">Accounting review required</p>
          ) : null}
        </div>

        {(quoteCompanyName || quoteCompanyAddress || quoteContactName || quoteContactEmail) && (
          <section className="mb-6 hidden rounded-lg border border-zinc-200 bg-white p-4 text-sm print:block">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quote to</h2>
            {quoteCompanyName ? <p className="mt-2 font-medium text-zinc-900">{quoteCompanyName}</p> : null}
            {quoteCompanyAddress ? (
              <p className="mt-1 whitespace-pre-wrap text-zinc-800">{quoteCompanyAddress}</p>
            ) : null}
            {quoteContactName || quoteContactEmail ? (
              <p className="mt-2 text-zinc-800">
                {quoteContactName ? <span>{quoteContactName}</span> : null}
                {quoteContactName && quoteContactEmail ? <span> · </span> : null}
                {quoteContactEmail ? <span>{quoteContactEmail}</span> : null}
              </p>
            ) : null}
            {accountingReviewRequired ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-900">
                Accounting review — credit limit / policy
              </p>
            ) : null}
          </section>
        )}

        <section className="mb-8 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:mb-0 print:shadow-none">
        {(quoteCompanyName || quoteCompanyAddress || quoteContactName || quoteContactEmail) && (
          <>
            <h2 className="text-sm font-medium text-zinc-900">Customer (quote)</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 print:hidden">
              {quoteCompanyName ? (
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Company</dt>
                  <dd className="text-zinc-900">
                    {estimate.companyId ? (
                      <Link
                        href={`/crm/accounts/${estimate.companyId}`}
                        className="font-medium underline hover:no-underline"
                      >
                        {quoteCompanyName}
                      </Link>
                    ) : (
                      quoteCompanyName
                    )}
                  </dd>
                </div>
              ) : null}
              {quoteCompanyAddress ? (
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Address (on quote)</dt>
                  <dd className="whitespace-pre-wrap text-zinc-900">{quoteCompanyAddress}</dd>
                </div>
              ) : null}
              {quoteContactName ? (
                <div>
                  <dt className="text-zinc-500">Contact</dt>
                  <dd className="text-zinc-900">{quoteContactName}</dd>
                </div>
              ) : null}
              {quoteContactEmail ? (
                <div>
                  <dt className="text-zinc-500">Email</dt>
                  <dd className="text-zinc-900">
                    <a href={`mailto:${quoteContactEmail}`} className="underline">
                      {quoteContactEmail}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
        <h2 className="text-sm font-medium text-zinc-900">Details</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div id="estimate-section-film" className="scroll-mt-24">
            <dt className="text-zinc-500">Film</dt>
            <dd className="text-zinc-900">{estimate.filmType}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Sheet size (summary)</dt>
            <dd className="text-zinc-900">{estimate.sheetSize}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Sheet length</dt>
            <dd className="font-medium text-zinc-900">
              {estimate.sheetLengthInches} in (feed direction)
            </dd>
          </div>
          <div id="estimate-section-quantity" className="scroll-mt-24">
            <dt className="text-zinc-500">Quantity</dt>
            <dd className="font-medium text-zinc-900">
              {estimate.lines.length > 0 ? (
                <>
                  <ul className="mt-0.5 list-inside list-disc space-y-1 font-normal">
                    {estimate.lines.map((l) => (
                      <li key={l.id} className="tabular-nums">
                        {l.label ? (
                          <>
                            <span className="font-medium text-zinc-900">{l.label}</span>
                            {": "}
                          </>
                        ) : null}
                        {l.quantity.toLocaleString()} sheets
                        <span className="text-zinc-600">
                          {" "}
                          (
                          {l.allocatedCostUsd.toLocaleString(undefined, {
                            style: "currency",
                            currency: "USD",
                          })}{" "}
                          allocated)
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {estimate.quantity.toLocaleString()} sheets total (order)
                  </p>
                  {estimate.spoilageAllowanceSheets > 0 && (
                    <span className="text-zinc-600">
                      +{estimate.spoilageAllowanceSheets} spoilage →{" "}
                      {estimate.quantity + estimate.spoilageAllowanceSheets} production sheets
                    </span>
                  )}
                </>
              ) : (
                <>
                  {estimate.quantity} sheets
                  {estimate.spoilageAllowanceSheets > 0 && (
                    <span className="text-zinc-600">
                      {" "}
                      (+{estimate.spoilageAllowanceSheets} spoilage → {estimate.quantity + estimate.spoilageAllowanceSheets}{" "}
                      production sheets)
                    </span>
                  )}
                </>
              )}
            </dd>
          </div>
          {estimate.passCount > 1 && (
            <div>
              <dt className="text-zinc-500">Passes</dt>
              <dd className="text-zinc-900">{estimate.passCount} (two-sided)</dd>
            </div>
          )}
          {(estimate.finalSheetWidthInches != null || estimate.finalSheetLengthInches != null) && (
            <div>
              <dt className="text-zinc-500">Final size (after cut)</dt>
              <dd className="tabular-nums text-zinc-900">
                {estimate.finalSheetWidthInches != null && estimate.finalSheetLengthInches != null
                  ? `${estimate.finalSheetWidthInches} × ${estimate.finalSheetLengthInches} in`
                  : "—"}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500">Pieces per sheet (final trim)</dt>
            <dd className="tabular-nums font-medium text-zinc-900">
              {estimate.finalTrimPiecesPerSheet}
            </dd>
          </div>
          {(estimate.finalSheetWidthInches != null || estimate.finalSheetLengthInches != null) && (
            <>
              <div>
                <dt className="text-zinc-500">Best imposition on sheet</dt>
                <dd className="text-zinc-900">
                  {estimate.finalTrimImpositionRotated
                    ? "Artwork rotated 90° (higher yield vs. entered width × length)"
                    : "Matches entered final width × length orientation"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Guillotine internal cuts</dt>
                <dd className="text-zinc-900">
                  {estimate.finalTrimNoBleedDutchCut
                    ? "No bleed — Dutch cut"
                    : "Bleed layout"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Press-ready (full sheet for yield)</dt>
                <dd className="text-zinc-900">{estimate.finalTrimIsPressReady ? "Yes" : "No"}</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-zinc-500">Est. finished pieces (order)</dt>
            <dd className="tabular-nums font-medium text-zinc-900">
              {(estimate.estimatedFinishedPieceCount ??
                estimate.quantity * estimate.finalTrimPiecesPerSheet
              ).toLocaleString()}{" "}
              <span className="font-normal text-zinc-600">
                (quantity × pieces/sheet)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Est. linear feet</dt>
            <dd className="font-medium tabular-nums text-zinc-900">
              {estimate.estimatedLinearFeet.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              ft
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Final delivery</dt>
            <dd className="text-zinc-900">
              {estimate.includesFinalDelivery ? (
                <>
                  <span className="font-medium">Yes</span>
                  {estimate.finalDeliveryCostUsd != null &&
                    Number.isFinite(estimate.finalDeliveryCostUsd) &&
                    estimate.finalDeliveryCostUsd > 0 && (
                      <p className="mt-1 text-sm tabular-nums text-zinc-700">
                        Delivery charge: $
                        {estimate.finalDeliveryCostUsd.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    )}
                  {estimate.finalDeliveryNotes != null &&
                    estimate.finalDeliveryNotes.trim() !== "" && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
                        {estimate.finalDeliveryNotes}
                      </p>
                    )}
                </>
              ) : (
                "No"
              )}
            </dd>
          </div>
          {estimate.machine && (
            <div>
              <dt className="text-zinc-500">Machine (at estimate)</dt>
              <dd className="font-medium text-zinc-900">{estimate.machine.name}</dd>
            </div>
          )}
          {estimate.printType != null && estimate.printType.trim() !== "" && (
            <div>
              <dt className="text-zinc-500">Print process</dt>
              <dd className="text-zinc-900">{estimate.printType}</dd>
            </div>
          )}
          <div id="estimate-section-paper" className="scroll-mt-24">
            <dt className="text-zinc-500">Paper color</dt>
            <dd className="text-zinc-900">{labelEstimatePaperColor(estimate.paperColor)}</dd>
          </div>
          {estimate.paperDescription != null && estimate.paperDescription.trim() !== "" && (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Paper / substrate</dt>
              <dd className="text-zinc-900">{estimate.paperDescription}</dd>
            </div>
          )}
          {estimate.paperGsm != null && (
            <div>
              <dt className="text-zinc-500">Paper GSM</dt>
              <dd className="tabular-nums text-zinc-900">{estimate.paperGsm}</dd>
            </div>
          )}
          {estimate.stockType != null && estimate.stockType !== "" && (
            <div>
              <dt className="text-zinc-500">Stock category</dt>
              <dd className="text-zinc-900">{estimate.stockType}</dd>
            </div>
          )}
          {estimate.estimatedRunTimeMinutes != null &&
            Number.isFinite(estimate.estimatedRunTimeMinutes) && (
              <div>
                <dt className="text-zinc-500">Est. run time (saved)</dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  {estimate.estimatedRunTimeMinutes < 90
                    ? `${estimate.estimatedRunTimeMinutes.toFixed(1)} min`
                    : `${Math.floor(estimate.estimatedRunTimeMinutes / 60)}h ${Math.round(estimate.estimatedRunTimeMinutes % 60)}m`}
                </dd>
              </div>
            )}
          {savedLineMpm != null && (
            <div>
              <dt className="text-zinc-500">Est. line speed (saved)</dt>
              <dd className="font-medium tabular-nums text-zinc-900">
                {savedLineMpm.toFixed(2)} m/min
                {savedSheetsPerHour != null
                  ? ` (~${formatSheetsPerHour(savedSheetsPerHour)})`
                  : ""}
              </dd>
            </div>
          )}
          {estimate.materialWidthInches != null && (
            <>
              <div>
                <dt className="text-zinc-500">Sheet width</dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  {estimate.materialWidthInches} in
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cross-web bare margin (total)</dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  {estimate.laminateWidthInsetInches != null &&
                  Number.isFinite(estimate.laminateWidthInsetInches)
                    ? `${estimate.laminateWidthInsetInches} in`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Laminate width (sheet − margin)</dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  {estimate.laminateWidthInches != null
                    ? `${estimate.laminateWidthInches} in`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Roll width (at estimate)</dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  {estimate.rollWidthSnapshotInches != null
                    ? `${estimate.rollWidthSnapshotInches} in`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Slit excess (cross-web)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.slitExcessWidthInches != null && estimate.slitExcessWidthInches > 0
                    ? `${estimate.slitExcessWidthInches} in wider than laminate`
                    : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Sheet sq in (reference)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.materialSquareInches != null
                    ? estimate.materialSquareInches.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Film on product (sq in)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.laminateFilmSquareInches != null
                    ? estimate.laminateFilmSquareInches.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Film off roll (sq in)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.filmFromRollSquareInches != null
                    ? estimate.filmFromRollSquareInches.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Slit waste (sq in)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.slitWasteSquareInches != null &&
                  estimate.slitWasteSquareInches > 0
                    ? estimate.slitWasteSquareInches.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Price / MSI (snapshot at estimate)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.pricePerFilmSquareInch != null
                    ? `$${estimate.pricePerFilmSquareInch.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}`
                    : "—"}
                </dd>
              </div>
            </>
          )}
          {estimate.filmRoll && (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Roll on hand</dt>
              <dd className="text-zinc-900">
                {estimate.filmRoll.remainingLinearFeet.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}{" "}
                lin. ft remaining
              </dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500">Markup / setup waste (film)</dt>
            <dd className="tabular-nums text-zinc-900">
              {estimate.markup} / {estimate.setupWaste}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Film material (est.)</dt>
            <dd className="tabular-nums text-zinc-900">
              $
              {filmMaterialUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
          {estimate.estimatedMachineCost != null && (
            <div>
              <dt className="text-zinc-500">Machine (est., run time × machine $/hr)</dt>
              <dd className="tabular-nums text-zinc-900">
                $
                {estimate.estimatedMachineCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
          {estimate.estimatedLaborCost != null && (
            <div>
              <dt className="text-zinc-500">
                Labor (est., make ready + side change + wash up + run × labor $/hr)
              </dt>
              <dd className="tabular-nums text-zinc-900">
                $
                {estimate.estimatedLaborCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
          {estimate.cutterMachine && (
            <div>
              <dt className="text-zinc-500">Cutter (at estimate)</dt>
              <dd className="font-medium text-zinc-900">{estimate.cutterMachine.name}</dd>
            </div>
          )}
          {estimate.estimatedCutCount != null && estimate.estimatedCutCount > 0 && (
            <div>
              <dt className="text-zinc-500">Total cuts (est.)</dt>
              <dd className="tabular-nums text-zinc-900">{estimate.estimatedCutCount}</dd>
            </div>
          )}
          {estimate.sheetThicknessInches != null &&
            Number.isFinite(estimate.sheetThicknessInches) &&
            estimate.sheetThicknessInches > 0 &&
            estimate.estimatedCutCount != null &&
            estimate.estimatedCutCount > 0 && (
              <div>
                <dt className="text-zinc-500">Sheet thickness (at estimate)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {formatSheetThicknessInchesLikePaperRef(estimate.sheetThicknessInches)} in
                </dd>
              </div>
            )}
          {estimate.estimatedCutterSheetsPerLift != null &&
            estimate.estimatedCutterSheetsPerLift > 0 &&
            estimate.estimatedCutCount != null &&
            estimate.estimatedCutCount > 0 && (
              <div>
                <dt className="text-zinc-500">Cutter sheets / lift (est.)</dt>
                <dd className="tabular-nums text-zinc-900">{estimate.estimatedCutterSheetsPerLift}</dd>
              </div>
            )}
          {estimate.estimatedCutterLiftCount != null &&
            estimate.estimatedCutterLiftCount > 0 &&
            estimate.estimatedCutCount != null &&
            estimate.estimatedCutCount > 0 && (
              <div>
                <dt className="text-zinc-500">Cutter lifts (est.)</dt>
                <dd className="tabular-nums text-zinc-900">{estimate.estimatedCutterLiftCount}</dd>
              </div>
            )}
          {estimate.estimatedCutterLaborHours != null &&
            Number.isFinite(estimate.estimatedCutterLaborHours) &&
            estimate.estimatedCutCount != null &&
            estimate.estimatedCutCount > 0 && (
              <div>
                <dt className="text-zinc-500">Cutter time (est. hours)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.estimatedCutterLaborHours.toLocaleString(undefined, {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 4,
                  })}{" "}
                  hr
                </dd>
              </div>
            )}
          {estimate.estimatedCutterMachineOnlyCost != null &&
            Number.isFinite(estimate.estimatedCutterMachineOnlyCost) &&
            estimate.estimatedCutCount != null &&
            estimate.estimatedCutCount > 0 && (
              <div>
                <dt className="text-zinc-500">Cutter machine (est.)</dt>
                <dd className="tabular-nums text-zinc-900">
                  $
                  {estimate.estimatedCutterMachineOnlyCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            )}
          {estimate.estimatedCutterLaborOnlyCost != null &&
            Number.isFinite(estimate.estimatedCutterLaborOnlyCost) &&
            estimate.estimatedCutCount != null &&
            estimate.estimatedCutCount > 0 && (
              <div>
                <dt className="text-zinc-500">Cutter labor (est.)</dt>
                <dd className="tabular-nums text-zinc-900">
                  $
                  {estimate.estimatedCutterLaborOnlyCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            )}
          {estimate.estimatedCutterCost != null &&
            Number.isFinite(estimate.estimatedCutterCost) &&
            estimate.estimatedCutCount != null &&
            estimate.estimatedCutCount > 0 && (
              <div>
                <dt className="text-zinc-500">Cutter total (est.)</dt>
                <dd className="tabular-nums text-zinc-900">
                  $
                  {estimate.estimatedCutterCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            )}
          {estimate.skidPackEnabled &&
            estimate.estimatedSkidPackInboundSkids != null &&
            estimate.estimatedSkidPackInboundSkids > 0 &&
            estimate.estimatedSkidPackOutboundSkids != null &&
            estimate.estimatedSkidPackOutboundSkids > 0 && (
              <div>
                <dt className="text-zinc-500">Skid pack (inbound → outbound)</dt>
                <dd className="tabular-nums text-zinc-900">
                  {estimate.estimatedSkidPackInboundSkids.toLocaleString()} →{" "}
                  {estimate.estimatedSkidPackOutboundSkids.toLocaleString()} skids
                  {estimate.skidPackPricePerSkidSnapshot != null &&
                    Number.isFinite(estimate.skidPackPricePerSkidSnapshot) && (
                      <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                        @ $
                        {estimate.skidPackPricePerSkidSnapshot.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        / outbound skid (snapshot)
                      </span>
                    )}
                </dd>
              </div>
            )}
          {estimate.skidPackEnabled &&
            estimate.estimatedSkidPackCost != null &&
            Number.isFinite(estimate.estimatedSkidPackCost) &&
            estimate.estimatedSkidPackCost > 0 && (
              <div>
                <dt className="text-zinc-500">Skid pack (est.)</dt>
                <dd className="tabular-nums text-zinc-900">
                  $
                  {estimate.estimatedSkidPackCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            )}
          {estimate.includesFinalDelivery &&
            estimate.finalDeliveryCostUsd != null &&
            Number.isFinite(estimate.finalDeliveryCostUsd) &&
            estimate.finalDeliveryCostUsd > 0 && (
              <div>
                <dt className="text-zinc-500">Final delivery (est.)</dt>
                <dd className="tabular-nums text-zinc-900">
                  $
                  {estimate.finalDeliveryCostUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            )}
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Estimate total</dt>
            <dd className="tabular-nums text-zinc-900">
              <span className="font-semibold">
                $
                {estimate.totalCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </dd>
          </div>
        </dl>
      </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 print:hidden">
        <h2 className="text-sm font-medium text-zinc-900">Job ticket</h2>
        {estimate.jobTicket ? (
          <div className="mt-4">
            <p className="text-sm text-zinc-600">
              This estimate is linked to job{" "}
              <Link
                href={`/jobs/${estimate.jobTicket.id}`}
                className="font-mono font-medium text-zinc-900 underline hover:no-underline"
              >
                {estimate.jobTicket.id}
              </Link>
              {" "}
              ({jobStatusLabel(estimate.jobTicket.status)}).
            </p>
            <Link
              href={`/jobs/${estimate.jobTicket.id}`}
              className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-100"
            >
              Open job ticket
            </Link>
          </div>
        ) : estimate.bundleId != null && estimate.bundleSortOrder !== 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Create a job from the first part of this quote (primary line).{" "}
            {bundleSiblings[0] != null ? (
              <Link
                href={`/estimates/${bundleSiblings[0].id}`}
                className="font-medium text-zinc-900 underline hover:no-underline"
              >
                Open first part
              </Link>
            ) : null}
          </p>
        ) : (
          <div className="mt-4">
            <ConvertToJobButton
              estimateId={estimate.id}
              filmOk={estimate.filmInventoryId != null}
              gsmOk={
                estimate.paperGsm != null &&
                Number.isFinite(estimate.paperGsm) &&
                estimate.paperGsm > 0
              }
              qtyOk={estimate.quantity > 0}
            />
          </div>
        )}
      </section>
    </div>
  );
}
