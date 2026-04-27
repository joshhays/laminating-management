"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { openBrowserPrintDialog } from "@/lib/open-browser-print-dialog";
import type { ShopQuoteBoilerplate } from "@/lib/shop-quote-settings";
import "./job-ticket-print.css";

export type LaminatingJobTicketEditInitial = {
  dueDate: Date | null;
  ticketTitle: string | null;
  ticketDescriptionAdditional: string | null;
  stockInformation: string | null;
  filmInformation: string | null;
  pressRunInformation: string | null;
  binderyInstructions: string | null;
  shippingInstructions: string | null;
  customerCompanyName: string | null;
  customerAddress: string | null;
  customerContactName: string | null;
  customerContactEmail: string | null;
};

export type JobTicketShellMeta = {
  jobId: string;
  jobNumberLabel: string;
  statusLabel: string;
  quoteLabel: string | null;
  estimateId: string | null;
  scheduleLabel: string | null;
  machineLine: string;
  shippedAtLabel: string | null;
  printedAtLabel: string;
  legacyNoSnapshot: boolean;
  shop: ShopQuoteBoilerplate;
};

type TicketForm = {
  dueDate: string;
  ticketTitle: string;
  ticketDescriptionAdditional: string;
  stockInformation: string;
  filmInformation: string;
  pressRunInformation: string;
  binderyInstructions: string;
  shippingInstructions: string;
  customerCompanyName: string;
  customerAddress: string;
  customerContactName: string;
  customerContactEmail: string;
};

function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initialToForm(initial: LaminatingJobTicketEditInitial): TicketForm {
  return {
    dueDate: toDateInputValue(initial.dueDate),
    ticketTitle: initial.ticketTitle ?? "",
    ticketDescriptionAdditional: initial.ticketDescriptionAdditional ?? "",
    stockInformation: initial.stockInformation ?? "",
    filmInformation: initial.filmInformation ?? "",
    pressRunInformation: initial.pressRunInformation ?? "",
    binderyInstructions: initial.binderyInstructions ?? "",
    shippingInstructions: initial.shippingInstructions ?? "",
    customerCompanyName: initial.customerCompanyName ?? "",
    customerAddress: initial.customerAddress ?? "",
    customerContactName: initial.customerContactName ?? "",
    customerContactEmail: initial.customerContactEmail ?? "",
  };
}

function formatDueTableCell(dueDateInput: string): string {
  if (!dueDateInput.trim()) return "—";
  const s = dueDateInput.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(`${s}T12:00:00.000Z`)
    : new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

function hasTicketBodyContent(f: TicketForm): boolean {
  return [
    f.ticketTitle,
    f.ticketDescriptionAdditional,
    f.stockInformation,
    f.filmInformation,
    f.pressRunInformation,
    f.binderyInstructions,
    f.shippingInstructions,
    f.customerCompanyName,
    f.customerAddress,
    f.customerContactName,
    f.customerContactEmail,
    f.dueDate,
  ].some((s) => s.trim() !== "");
}

function TicketSection({ label, value }: { label: string; value: string }) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">{trimmed}</p>
    </div>
  );
}

function TicketArticle({
  form,
  meta,
}: {
  form: TicketForm;
  meta: JobTicketShellMeta;
}) {
  const dueLabel = formatDueTableCell(form.dueDate);
  const showLegacy = meta.legacyNoSnapshot && !hasTicketBodyContent(form);

  return (
    <article className="job-ticket-print-article min-h-0 font-serif text-zinc-900">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight print:text-4xl">
            Laminating job ticket
          </h1>
          <p className="mt-2 font-mono text-[11px] text-zinc-500">{meta.jobId}</p>
        </div>
        <p className="text-3xl font-semibold tabular-nums print:text-4xl">{meta.jobNumberLabel}</p>
      </header>

      <section className="mt-6 grid gap-8 md:grid-cols-2" aria-label="Shop and customer">
        <div className="text-sm leading-relaxed">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Shop</p>
          <p className="mt-2 text-base font-semibold">{meta.shop.letterhead.companyName}</p>
          {meta.shop.letterhead.addressLines.map((line, i) => (
            <p key={`${i}-${line}`}>{line}</p>
          ))}
          {meta.shop.letterhead.phone ? (
            <p className="mt-1">Phone: {meta.shop.letterhead.phone}</p>
          ) : null}
        </div>
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Customer</p>
          {form.customerCompanyName.trim() ? (
            <p className="mt-2 text-base font-semibold">{form.customerCompanyName}</p>
          ) : (
            <p className="mt-2 text-zinc-500">—</p>
          )}
          {form.customerContactName.trim() ? (
            <p className="mt-2 font-medium">Attn: {form.customerContactName}</p>
          ) : null}
          {form.customerContactEmail.trim() ? (
            <p className="mt-1">{form.customerContactEmail}</p>
          ) : null}
          {form.customerAddress.trim() ? (
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{form.customerAddress}</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8" aria-label="Job reference">
        <h2 className="sr-only">Job details</h2>
        <table className="w-full border-collapse border border-zinc-900 text-sm">
          <tbody>
            <tr>
              <th
                scope="row"
                className="w-[34%] border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
              >
                Status
              </th>
              <td className="border border-zinc-900 px-3 py-2">{meta.statusLabel}</td>
            </tr>
            {meta.quoteLabel ? (
              <tr>
                <th
                  scope="row"
                  className="border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
                >
                  Quote
                </th>
                <td className="border border-zinc-900 px-3 py-2 tabular-nums">{meta.quoteLabel}</td>
              </tr>
            ) : null}
            <tr>
              <th
                scope="row"
                className="border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
              >
                Due date
              </th>
              <td className="border border-zinc-900 px-3 py-2">{dueLabel}</td>
            </tr>
            <tr>
              <th
                scope="row"
                className="border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
              >
                Schedule
              </th>
              <td className="border border-zinc-900 px-3 py-2 whitespace-pre-wrap">
                {meta.scheduleLabel ?? "—"}
              </td>
            </tr>
            <tr>
              <th
                scope="row"
                className="border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
              >
                Laminator / line
              </th>
              <td className="border border-zinc-900 px-3 py-2">{meta.machineLine}</td>
            </tr>
            {meta.shippedAtLabel ? (
              <tr>
                <th
                  scope="row"
                  className="border border-zinc-900 bg-zinc-50 px-3 py-2 text-left font-medium print:bg-transparent"
                >
                  Shipped
                </th>
                <td className="border border-zinc-900 px-3 py-2">{meta.shippedAtLabel}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="mt-8 text-sm" aria-label="Production ticket">
        {showLegacy ? (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            No ticket snapshot was stored for this job (it may pre-date job tickets). Use the
            editors below to fill in the ticket, save, then print.
          </p>
        ) : null}
        {form.ticketTitle.trim() ? (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Description
            </p>
            <p className="mt-2 text-base font-semibold leading-snug">{form.ticketTitle}</p>
          </div>
        ) : null}
        <TicketSection label="Additional description" value={form.ticketDescriptionAdditional} />
        <TicketSection label="Stock" value={form.stockInformation} />
        <TicketSection label="Film" value={form.filmInformation} />
        <TicketSection label="Laminator / press run" value={form.pressRunInformation} />
        <TicketSection label="Bindery / cutting" value={form.binderyInstructions} />
        <TicketSection label="Shipping" value={form.shippingInstructions} />
      </section>

      <footer className="mt-12 border-t border-zinc-300 pt-6 text-sm text-zinc-600">
        <p className="text-[11px] leading-snug">
          Internal production document — not a customer quotation.
        </p>
        <p className="mt-2 text-[11px] tabular-nums">Generated {meta.printedAtLabel}</p>
        <p className="mt-6 text-center text-[11px] text-zinc-500">Page 1 of 1</p>
      </footer>
    </article>
  );
}

type Props = {
  meta: JobTicketShellMeta;
  initial: LaminatingJobTicketEditInitial;
};

export function JobTicketShell({ meta, initial }: Props) {
  const router = useRouter();
  const mergedInitial = useMemo(() => initialToForm(initial), [initial]);
  const [form, setForm] = useState<TicketForm>(() => ({ ...mergedInitial }));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setForm({ ...mergedInitial });
  }, [mergedInitial, editing]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/job-tickets/${meta.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: form.dueDate.trim() === "" ? null : form.dueDate.trim(),
          ticketTitle: form.ticketTitle.trim() === "" ? null : form.ticketTitle,
          ticketDescriptionAdditional:
            form.ticketDescriptionAdditional.trim() === ""
              ? null
              : form.ticketDescriptionAdditional,
          stockInformation: form.stockInformation.trim() === "" ? null : form.stockInformation,
          filmInformation: form.filmInformation.trim() === "" ? null : form.filmInformation,
          pressRunInformation:
            form.pressRunInformation.trim() === "" ? null : form.pressRunInformation,
          binderyInstructions:
            form.binderyInstructions.trim() === "" ? null : form.binderyInstructions,
          shippingInstructions:
            form.shippingInstructions.trim() === "" ? null : form.shippingInstructions,
          customerCompanyName:
            form.customerCompanyName.trim() === "" ? null : form.customerCompanyName,
          customerAddress: form.customerAddress.trim() === "" ? null : form.customerAddress,
          customerContactName:
            form.customerContactName.trim() === "" ? null : form.customerContactName,
          customerContactEmail:
            form.customerContactEmail.trim() === "" ? null : form.customerContactEmail,
        }),
      });
      const raw = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(raw.error ?? "Save failed");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }, [meta.jobId, router, form]);

  function cancelEdit() {
    setError(null);
    setEditing(false);
    setForm({ ...mergedInitial });
  }

  return (
    <div className="job-ticket-print-page min-h-screen bg-zinc-100 print:bg-white">
      <div className="job-ticket-print-wrap mx-auto w-full max-w-[8.5in] px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <div className="mb-8 flex flex-wrap items-center gap-3 print:hidden">
          <Link
            href={`/jobs/${meta.jobId}`}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Job
          </Link>
          {meta.estimateId ? (
            <Link
              href={`/estimates/${meta.estimateId}`}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
            >
              Estimate
              {meta.quoteLabel ? ` (${meta.quoteLabel})` : ""}
            </Link>
          ) : null}
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
              Edit ticket
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
            </>
          )}
          {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
        </div>

        {editing ? (
          <div className="mb-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm print:hidden">
            <p className="text-xs text-zinc-500">
              Changes are stored on this job only (they do not change the original estimate).               Use <strong>Print</strong> or <strong>Save as PDF</strong> when finished (same browser
              print dialog).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Due date
                </span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Customer — company
                </span>
                <input
                  value={form.customerCompanyName}
                  onChange={(e) => setForm((p) => ({ ...p, customerCompanyName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Customer — address
                </span>
                <textarea
                  value={form.customerAddress}
                  onChange={(e) => setForm((p) => ({ ...p, customerAddress: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Customer — contact name
                </span>
                <input
                  value={form.customerContactName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customerContactName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Customer — email
                </span>
                <input
                  type="email"
                  value={form.customerContactEmail}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customerContactEmail: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Description
                </span>
                <textarea
                  value={form.ticketTitle}
                  onChange={(e) => setForm((p) => ({ ...p, ticketTitle: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Additional description
                </span>
                <textarea
                  value={form.ticketDescriptionAdditional}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, ticketDescriptionAdditional: e.target.value }))
                  }
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Stock
                </span>
                <textarea
                  value={form.stockInformation}
                  onChange={(e) => setForm((p) => ({ ...p, stockInformation: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Film
                </span>
                <textarea
                  value={form.filmInformation}
                  onChange={(e) => setForm((p) => ({ ...p, filmInformation: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Laminator / press run
                </span>
                <textarea
                  value={form.pressRunInformation}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, pressRunInformation: e.target.value }))
                  }
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Bindery / cutting
                </span>
                <textarea
                  value={form.binderyInstructions}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, binderyInstructions: e.target.value }))
                  }
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Shipping
                </span>
                <textarea
                  value={form.shippingInstructions}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, shippingInstructions: e.target.value }))
                  }
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div
          id="job-ticket-export-root"
          className="job-ticket-print-sheet box-border w-full min-h-[11in] max-w-none rounded-sm border border-zinc-200 bg-white p-[0.5in] shadow-sm print:rounded-none print:border-0 print:shadow-none"
        >
          <TicketArticle form={form} meta={meta} />
        </div>
      </div>
    </div>
  );
}
