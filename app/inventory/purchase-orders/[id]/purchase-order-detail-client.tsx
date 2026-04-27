"use client";

import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { filmMaterialTypeLabel } from "@/lib/film-material-type";

type PoWithLines = PurchaseOrder & { lines: PurchaseOrderLine[] };

function statusLabel(s: PurchaseOrderStatus) {
  switch (s) {
    case "DRAFT":
      return "Draft";
    case "ORDERED":
      return "Ordered";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
    default:
      return s;
  }
}

export function PurchaseOrderDetailClient({ initial }: { initial: PoWithLines }) {
  const router = useRouter();
  const [po, setPo] = useState(initial);
  const [materialLabels, setMaterialLabels] = useState<Record<string, string>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [receiveRows, setReceiveRows] = useState<Record<string, string>>({});
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/film-material-types")
      .then((r) => r.json())
      .then((rows: Array<{ code: string; label: string }>) => {
        setMaterialLabels(Object.fromEntries(rows.map((x) => [x.code, x.label])));
      })
      .catch(() => {});
  }, []);

  function buildEmailBody() {
    const hdr = `Supplier: ${po.supplierName ?? "—"}\nReference: ${po.reference ?? "—"}\n\nLines:\n`;
    const lines = po.lines
      .map(
        (l) =>
          `- ${l.description}: ${l.orderedLinearFeet.toLocaleString()} lin ft ordered (${l.thicknessMil} mil × ${l.rollWidth}" )`,
      )
      .join("\n");
    const tail = po.notes?.trim() ? `\n\nNotes:\n${po.notes}` : "";
    return hdr + lines + tail;
  }

  async function patchVendorEmail(email: string) {
    const res = await fetch(`/api/purchase-orders/${po.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorEmail: email.trim() || null }),
    });
    const data = (await res.json().catch(() => ({}))) as PoWithLines & { error?: string };
    if (res.ok) setPo(data as PoWithLines);
  }

  async function markSentToVendor() {
    setStatusLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markSent: true }),
      });
      const data = (await res.json().catch(() => ({}))) as PoWithLines & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      setPo(data as PoWithLines);
      router.refresh();
    } finally {
      setStatusLoading(false);
    }
  }

  async function patchStatus(status: PurchaseOrderStatus) {
    setStatusLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as PoWithLines & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      setPo(data as PoWithLines);
      router.refresh();
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    const receipts = Object.entries(receiveRows)
      .map(([purchaseOrderLineId, linearFeetReceived]) => ({
        purchaseOrderLineId,
        linearFeetReceived: Number(linearFeetReceived),
      }))
      .filter((r) => r.purchaseOrderLineId && Number.isFinite(r.linearFeetReceived) && r.linearFeetReceived > 0);

    if (receipts.length === 0) {
      setError("Enter at least one positive quantity to receive.");
      return;
    }

    setReceiveLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipts }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Receive failed");
        return;
      }
      setReceiveRows({});
      const refreshed = await fetch(`/api/purchase-orders/${po.id}`).then((r) => r.json());
      setPo(refreshed as PoWithLines);
      router.refresh();
    } finally {
      setReceiveLoading(false);
    }
  }

  const hasOpenLines = po.lines.some(
    (line) => line.orderedLinearFeet - line.receivedLinearFeet > 1e-9,
  );
  const canReceive =
    hasOpenLines &&
    (po.status === "ORDERED" ||
      po.status === "PARTIALLY_RECEIVED" ||
      po.status === "RECEIVED");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
          {statusLabel(po.status)}
        </span>
        {po.status === "DRAFT" && (
          <button
            type="button"
            disabled={statusLoading}
            onClick={() => void patchStatus("ORDERED")}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Mark ordered
          </button>
        )}
        {po.status !== "CANCELLED" && po.status !== "DRAFT" && (
          <button
            type="button"
            disabled={statusLoading}
            onClick={() => void patchStatus("CANCELLED")}
            className="text-sm text-red-700 underline disabled:opacity-50"
          >
            Cancel PO
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-zinc-900">Send to vendor</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Save a vendor email, open your mail app with a prefilled request, then mark sent when it goes out.
        </p>
        <label className="mt-3 block text-sm">
          <span className="font-medium text-zinc-800">Vendor email</span>
          <input
            type="email"
            className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            defaultValue={po.vendorEmail ?? ""}
            key={po.vendorEmail ?? "empty"}
            onBlur={(e) => void patchVendorEmail(e.target.value)}
            placeholder="orders@vendor.com"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={
              po.vendorEmail?.trim()
                ? `mailto:${po.vendorEmail.trim()}?subject=${encodeURIComponent(
                    `Purchase order ${po.reference?.trim() || po.id.slice(0, 8)}`,
                  )}&body=${encodeURIComponent(buildEmailBody())}`
                : undefined
            }
            className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-medium ${
              po.vendorEmail?.trim()
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "cursor-not-allowed bg-zinc-200 text-zinc-500"
            }`}
            aria-disabled={!po.vendorEmail?.trim()}
            onClick={(e) => {
              if (!po.vendorEmail?.trim()) e.preventDefault();
            }}
          >
            Open email draft
          </a>
          <button
            type="button"
            disabled={statusLoading}
            onClick={() => void markSentToVendor()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            Record sent
          </button>
        </div>
        {po.sentAt != null && (
          <p className="mt-2 text-xs text-zinc-500">
            Marked sent{" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(po.sentAt),
            )}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-zinc-900">Lines</h2>
        <ul className="mt-4 divide-y divide-zinc-100">
          {po.lines.map((line) => {
            const open = line.orderedLinearFeet - line.receivedLinearFeet;
            return (
              <li key={line.id} className="py-4 first:pt-0">
                <p className="font-medium text-zinc-900">{line.description}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {filmMaterialTypeLabel(line.materialType, materialLabels)} · {line.thicknessMil}{" "}
                  mil ·{" "}
                  {line.rollWidth}&Prime; web
                </p>
                <p className="mt-2 text-sm tabular-nums text-zinc-800">
                  Ordered {line.orderedLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  lin. ft · Received{" "}
                  {line.receivedLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  · Open{" "}
                  {open.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                {line.filmInventoryId ? (
                  <p className="mt-2 text-xs">
                    <Link
                      href={`/inventory/film/${line.filmInventoryId}`}
                      className="font-medium text-zinc-800 underline hover:text-zinc-950"
                    >
                      Linked film item
                    </Link>
                    <span className="text-zinc-500">
                      {" "}
                      — receive adds linear feet to this roll
                    </span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {canReceive && po.status !== "CANCELLED" && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-900">Receive into inventory</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Linked lines add feet to the existing film SKU. Unlinked lines create a new roll. Set pricing on
            the film inventory screen if needed.
          </p>
          <form onSubmit={(e) => void handleReceive(e)} className="mt-4 space-y-4">
            {po.lines.map((line) => {
              const open = line.orderedLinearFeet - line.receivedLinearFeet;
              if (open <= 1e-9) {
                return (
                  <div key={line.id} className="text-sm text-zinc-500">
                    {line.description}: fully received
                  </div>
                );
              }
              return (
                <label key={line.id} className="block text-sm">
                  <span className="font-medium text-zinc-800">
                    Receive (lin. ft) — {line.description}{" "}
                    <span className="font-normal text-zinc-500">
                      (max {open.toFixed(2)})
                    </span>
                  </span>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    max={open}
                    className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    value={receiveRows[line.id] ?? ""}
                    onChange={(e) =>
                      setReceiveRows((R) => ({ ...R, [line.id]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </label>
              );
            })}
            <button
              type="submit"
              disabled={receiveLoading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {receiveLoading ? "Receiving…" : "Receive"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
