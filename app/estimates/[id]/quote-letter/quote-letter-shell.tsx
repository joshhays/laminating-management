"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatCurrencyUsd } from "@/lib/quote-letter-content";
import {
  MAX_QUOTE_PARTS,
  mergeQuoteLetterForm,
  quoteLetterPartsTotalUsd,
  type QuoteLetterContentDefaults,
  type QuoteLetterEdits,
  type QuoteLetterFormState,
  type QuoteLetterPartLine,
} from "@/lib/quote-letter-edits";
import { openBrowserPrintDialog } from "@/lib/open-browser-print-dialog";
import type { ShopQuoteBoilerplate } from "@/lib/shop-quote-settings";
import "./quote-letter-print.css";

export type QuoteLetterShellEstimate = {
  id: string;
  quoteNo: string;
  quoteDate: string;
  quoteCompanyName: string | null;
  quoteCompanyAddress: string | null;
  quoteContactName: string | null;
  accountingReviewRequired: boolean;
  quantityLabel: string;
};

type Props = {
  estimate: QuoteLetterShellEstimate;
  shop: ShopQuoteBoilerplate;
  defaults: QuoteLetterFormState;
  savedEdits: QuoteLetterEdits | null;
};

const SPEC_BLOCKS: { key: Exclude<keyof QuoteLetterContentDefaults, "introLine">; label: string }[] =
  [
    { key: "description", label: "Description" },
    { key: "size", label: "Size" },
    { key: "paper", label: "Paper" },
    { key: "finishing", label: "Finishing" },
  ];

/**
 * Quote letter ticket — semantic HTML template for screen, print, and “Save as PDF” via window.print().
 */
export function QuoteLetterShell({ estimate, shop, defaults, savedEdits }: Props) {
  const router = useRouter();
  const mergedInitial = useMemo(
    () => mergeQuoteLetterForm(defaults, savedEdits),
    [defaults, savedEdits],
  );
  const [form, setForm] = useState<QuoteLetterFormState>(() => ({ ...mergedInitial }));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setForm({ ...mergeQuoteLetterForm(defaults, savedEdits) });
  }, [defaults, savedEdits, editing]);

  const partsTotal = quoteLetterPartsTotalUsd(form.parts);
  const totalStr = formatCurrencyUsd(partsTotal);

  function updatePart(index: number, patch: Partial<QuoteLetterPartLine>) {
    setForm((p) => ({
      ...p,
      parts: p.parts.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  }

  function addPart() {
    setForm((p) =>
      p.parts.length >= MAX_QUOTE_PARTS
        ? p
        : {
            ...p,
            parts: [...p.parts, { partLabel: "", sheets: "", priceUsd: 0 }],
          },
    );
  }

  function removePart(index: number) {
    setForm((p) =>
      p.parts.length <= 1
        ? p
        : { ...p, parts: p.parts.filter((_, i) => i !== index) },
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/quote-letter`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: {
            description: form.description,
            size: form.size,
            paper: form.paper,
            finishing: form.finishing,
            introLine: form.introLine,
          },
          parts: form.parts,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function revertToEstimate() {
    setError(null);
    setForm({ ...defaults });
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
    setForm({ ...mergeQuoteLetterForm(defaults, savedEdits) });
  }

  return (
    <div className="quote-letter-page min-h-screen bg-zinc-100 print:bg-white">
      <div className="quote-letter-screen-wrap mx-auto w-full max-w-[8.5in] px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <div className="mb-8 flex flex-wrap items-center gap-3 print:hidden">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Estimate
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openBrowserPrintDialog()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
              title="Opens the print dialog — choose your printer here"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => openBrowserPrintDialog()}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
              title='Opens the same dialog — set Destination to “Save as PDF”'
            >
              Save as PDF
            </button>
          </div>
          <p className="w-full text-xs text-zinc-500">
            Both use your browser’s print window: pick a <strong>printer</strong> to print, or{" "}
            <strong>Save as PDF</strong> as the destination.
          </p>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Edit letter text
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={revertToEstimate}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-50"
              >
                Reset to estimate wording
              </button>
            </>
          )}
          {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
        </div>

        <div
          id="quote-letter-export-root"
          className="quote-letter-sheet box-border w-full min-h-[11in] max-w-none rounded-sm border border-zinc-200 bg-white p-[0.5in] shadow-sm print:rounded-none print:border-0 print:shadow-none"
        >
          <article className="quote-letter-ticket min-h-0 font-serif text-zinc-900">
            <header className="quote-ticket-masthead flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-4">
              <h1 className="text-3xl font-semibold tracking-tight print:text-4xl">Quotation</h1>
              <p className="text-3xl font-semibold tabular-nums print:text-4xl">{estimate.quoteNo}</p>
            </header>

            <section className="quote-ticket-parties mt-6 grid gap-8 md:grid-cols-2" aria-label="Vendor and customer">
              <div className="text-sm leading-relaxed">
                <p className="text-base font-semibold">{shop.letterhead.companyName}</p>
                {shop.letterhead.addressLines.map((line, i) => (
                  <p key={`${i}-${line}`}>{line}</p>
                ))}
                {shop.letterhead.phone ? <p>Phone: {shop.letterhead.phone}</p> : null}
                {shop.letterhead.fax ? <p>Fax: {shop.letterhead.fax}</p> : null}
                {shop.letterhead.website ? (
                  <p>
                    <a
                      href={
                        shop.letterhead.website.startsWith("http")
                          ? shop.letterhead.website
                          : `https://${shop.letterhead.website}`
                      }
                      className="text-zinc-900 underline print:text-inherit print:no-underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {shop.letterhead.website.replace(/^https?:\/\//, "")}
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">To</p>
                {estimate.quoteCompanyName ? (
                  <p className="mt-2 text-base font-semibold">{estimate.quoteCompanyName}</p>
                ) : (
                  <p className="mt-2 text-zinc-500">—</p>
                )}
                {estimate.quoteCompanyAddress ? (
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed">{estimate.quoteCompanyAddress}</p>
                ) : null}
              </div>
            </section>

            <section className="quote-ticket-meta mt-8" aria-labelledby="quote-ticket-meta-caption">
              <h2 id="quote-ticket-meta-caption" className="sr-only">
                Quote reference
              </h2>
              <table className="w-full border-collapse border border-zinc-900 text-sm">
                <tbody>
                  <tr>
                    <th
                      scope="row"
                      className="w-[34%] border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
                    >
                      Date
                    </th>
                    <td className="border border-zinc-900 px-3 py-2 tabular-nums">{estimate.quoteDate}</td>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
                    >
                      Salesperson
                    </th>
                    <td className="border border-zinc-900 px-3 py-2">{shop.salespersonName}</td>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      className="border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
                    >
                      Estimator
                    </th>
                    <td className="border border-zinc-900 px-3 py-2">{shop.estimatorName}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="quote-ticket-body mt-8 text-sm" aria-label="Cover letter and specifications">
              {!editing ? (
                <>
                  <p className="leading-relaxed">{form.introLine}</p>
                  <p className="mt-3 text-xs italic text-zinc-700">{shop.confidentialityLine}</p>
                  {estimate.quoteContactName ? (
                    <p className="mt-4 font-semibold">{estimate.quoteContactName}</p>
                  ) : null}
                  {estimate.accountingReviewRequired ? (
                    <p className="mt-4 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                      Accounting review — credit or policy flag at time of quote. Confirm pricing before
                      sending externally.
                    </p>
                  ) : null}
                  <dl className="mt-8 space-y-4">
                    {SPEC_BLOCKS.map(({ key, label }) => (
                      <div key={key}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{label}</dt>
                        <dd className="mt-1 leading-relaxed">{form[key]}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <>
                  <div className="space-y-6 print:hidden">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        Intro paragraph
                      </span>
                      <textarea
                        value={form.introLine}
                        onChange={(e) => setForm((prev) => ({ ...prev, introLine: e.target.value }))}
                        rows={4}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400"
                      />
                    </label>
                    {SPEC_BLOCKS.map(({ key, label }) => (
                      <label key={key} className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          {label}
                        </span>
                        <textarea
                          value={form[key]}
                          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400"
                        />
                      </label>
                    ))}
                    <p className="text-xs italic text-zinc-700">{shop.confidentialityLine}</p>
                    {estimate.quoteContactName ? (
                      <p className="font-semibold">{estimate.quoteContactName}</p>
                    ) : null}
                    {estimate.accountingReviewRequired ? (
                      <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                        Accounting review — credit or policy flag at time of quote. Confirm pricing before
                        sending externally.
                      </p>
                    ) : null}
                  </div>
                  <div className="hidden print:block">
                    <p className="leading-relaxed">{form.introLine}</p>
                    <p className="mt-3 text-xs italic text-zinc-700">{shop.confidentialityLine}</p>
                    {estimate.quoteContactName ? (
                      <p className="mt-4 font-semibold">{estimate.quoteContactName}</p>
                    ) : null}
                    {estimate.accountingReviewRequired ? (
                      <p className="mt-4 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                        Accounting review — credit or policy flag at time of quote. Confirm pricing before
                        sending externally.
                      </p>
                    ) : null}
                    <dl className="mt-8 space-y-4">
                      {SPEC_BLOCKS.map(({ key, label }) => (
                        <div key={`print-${key}`}>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                            {label}
                          </dt>
                          <dd className="mt-1 leading-relaxed">{form[key]}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </>
              )}
            </section>

            <section className="quote-ticket-pricing mt-8" aria-label="Parts, quantity, and price">
              {editing ? (
                <p className="mb-2 text-xs text-zinc-600 print:hidden">
                  Add a row per part (e.g. cover + insert). Total is the sum of all part prices.
                </p>
              ) : null}
              <table className="w-full border-collapse border border-zinc-900 text-sm">
                <thead>
                  <tr className="bg-zinc-100 print:bg-transparent">
                    <th
                      scope="col"
                      className="border border-zinc-900 px-3 py-2 text-left font-semibold w-[28%]"
                    >
                      Part
                    </th>
                    <th scope="col" className="border border-zinc-900 px-3 py-2 text-left font-semibold">
                      {estimate.quantityLabel}
                    </th>
                    <th
                      scope="col"
                      className="border border-zinc-900 px-3 py-2 text-left font-semibold w-[30%]"
                    >
                      Prices
                    </th>
                    {editing ? (
                      <th
                        scope="col"
                        className="border border-zinc-900 px-2 py-2 text-center font-semibold w-12 print:hidden"
                      >
                        <span className="sr-only">Remove row</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {form.parts.map((line, index) => (
                    <tr key={index}>
                      <td className="border border-zinc-900 px-3 py-2 align-middle">
                        {editing ? (
                          <input
                            type="text"
                            value={line.partLabel}
                            onChange={(e) => updatePart(index, { partLabel: e.target.value })}
                            placeholder="e.g. Cover"
                            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                            autoComplete="off"
                          />
                        ) : (
                          <span>{line.partLabel.trim() ? line.partLabel : "—"}</span>
                        )}
                      </td>
                      <td className="border border-zinc-900 px-3 py-2 align-middle">
                        {editing ? (
                          <input
                            type="text"
                            value={line.sheets}
                            onChange={(e) => updatePart(index, { sheets: e.target.value })}
                            className="w-full min-w-[6rem] rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                            autoComplete="off"
                          />
                        ) : (
                          <span>{line.sheets}</span>
                        )}
                      </td>
                      <td className="border border-zinc-900 px-3 py-2 align-middle">
                        {editing ? (
                          <div className="flex items-center gap-1 font-medium tabular-nums">
                            <span className="text-zinc-500">$</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={line.priceUsd}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                updatePart(index, {
                                  priceUsd: Number.isFinite(v) && v >= 0 ? v : 0,
                                });
                              }}
                              className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                            />
                          </div>
                        ) : (
                          <span className="font-medium tabular-nums">
                            {formatCurrencyUsd(line.priceUsd)}
                          </span>
                        )}
                      </td>
                      {editing ? (
                        <td className="border border-zinc-900 px-1 py-2 align-middle print:hidden">
                          <button
                            type="button"
                            disabled={form.parts.length <= 1}
                            onClick={() => removePart(index)}
                            className="mx-auto block rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                            aria-label={`Remove part ${index + 1}`}
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  <tr className="font-semibold bg-zinc-50 print:bg-transparent">
                    <td className="border border-zinc-900 px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td
                      className="border border-zinc-900 px-3 py-2 tabular-nums"
                      colSpan={editing ? 2 : 1}
                    >
                      {totalStr}
                    </td>
                  </tr>
                </tbody>
              </table>
              {editing ? (
                <div className="mt-3 print:hidden">
                  <button
                    type="button"
                    disabled={form.parts.length >= MAX_QUOTE_PARTS}
                    onClick={addPart}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Add part
                    {form.parts.length >= MAX_QUOTE_PARTS
                      ? ` (max ${MAX_QUOTE_PARTS})`
                      : ""}
                  </button>
                </div>
              ) : null}
            </section>

            <section className="quote-ticket-terms mt-8 text-sm" aria-label="Terms and conditions">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Terms</p>
              <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
                {shop.termsLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <footer className="quote-ticket-footer mt-10 text-sm">
              <p className="leading-relaxed">{shop.closingLine}</p>
              <p className="mt-2">—{shop.signOffFirstName}</p>

              <div className="mt-12 grid gap-8 border-t border-zinc-300 pt-6 sm:grid-cols-2">
                <div>
                  <p className="font-semibold">Quoted by</p>
                  <p className="mt-2 text-zinc-800">{shop.quotedByName}</p>
                  <p className="mt-4 text-xs text-zinc-600">Sign:</p>
                  <div className="mt-1 border-b border-zinc-900 pb-6" />
                  <p className="mt-3 text-xs text-zinc-600">Date:</p>
                  <div className="mt-1 border-b border-zinc-900 pb-4" />
                </div>
                <div>
                  <p className="font-semibold">Accepted by</p>
                  <p className="mt-4 text-xs text-zinc-600">Sign:</p>
                  <div className="mt-1 border-b border-zinc-900 pb-6" />
                  <p className="mt-3 text-xs text-zinc-600">Date:</p>
                  <div className="mt-1 border-b border-zinc-900 pb-4" />
                </div>
              </div>

              <p className="mt-10 text-[11px] leading-snug text-zinc-600">{shop.disclaimer}</p>
              <p className="mt-6 text-center text-[11px] text-zinc-500">Page 1 of 1</p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
