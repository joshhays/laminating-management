"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ShortfallLine = {
  allocationId: string;
  filmInventoryId: string;
  description: string;
  vendor: string | null;
  stockKind: string;
  needLinearFeet: number;
  onHandLinearFeet: number;
  onOrderOpenLinearFeet: number;
  suggestPurchaseLinearFeet: number;
};

type DraftPo = { id: string; reference: string | null; supplierName: string | null };

export function JobFilmPurchaseClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<ShortfallLine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [draftsByFilm, setDraftsByFilm] = useState<Record<string, DraftPo[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/job-tickets/${jobId}/film-shortfall`);
      const data = (await res.json()) as { lines?: ShortfallLine[]; error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not load film plan");
        setLines(null);
        return;
      }
      setLines(data.lines ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDrafts = useCallback(async (vendor: string | null, filmInventoryId: string) => {
    if (!vendor?.trim()) {
      setDraftsByFilm((m) => ({ ...m, [filmInventoryId]: [] }));
      return;
    }
    const res = await fetch(
      `/api/purchase-orders/draft-by-vendor?vendor=${encodeURIComponent(vendor)}`,
    );
    const arr = res.ok ? ((await res.json()) as DraftPo[]) : [];
    setDraftsByFilm((m) => ({ ...m, [filmInventoryId]: arr }));
  }, []);

  useEffect(() => {
    if (!lines?.length) return;
    for (const ln of lines) {
      void loadDrafts(ln.vendor, ln.filmInventoryId);
    }
  }, [lines, loadDrafts]);

  async function addToDraft(poId: string, row: ShortfallLine) {
    setBusyKey(`${row.filmInventoryId}-${poId}`);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filmInventoryId: row.filmInventoryId,
          orderedLinearFeet: row.suggestPurchaseLinearFeet,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not add line");
        return;
      }
      router.push(`/inventory/purchase-orders/${poId}`);
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return null;
  if (!lines || lines.length === 0) return null;

  return (
    <section className="mb-10 rounded-xl border border-amber-200 bg-amber-50/80 p-6 shadow-sm">
      <h2 className="text-sm font-medium text-amber-950">Film — purchase needed</h2>
      <p className="mt-1 text-xs text-amber-900">
        On-hand and open PO lines don&apos;t fully cover these job allocations. Create a purchase order or add
        to an existing <strong>draft</strong> for the same vendor.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-4 space-y-4">
        {lines.map((row) => {
          const drafts = draftsByFilm[row.filmInventoryId] ?? [];
          const newPoHref = `/inventory/purchase-orders/new?filmId=${encodeURIComponent(row.filmInventoryId)}&feet=${encodeURIComponent(String(row.suggestPurchaseLinearFeet))}`;
          return (
            <li
              key={row.allocationId}
              className="rounded-lg border border-amber-200/80 bg-white/90 px-4 py-3 text-sm"
            >
              <p className="font-medium text-zinc-900">
                {row.description}{" "}
                <span className="font-normal text-zinc-500">
                  ({row.stockKind === "CATALOG" ? "Catalog" : "Floor"} roll)
                </span>
              </p>
              <dl className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <div>
                  Need for job:{" "}
                  <span className="font-semibold tabular-nums text-zinc-800">
                    {row.needLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })} lin ft
                  </span>
                </div>
                <div>
                  On hand:{" "}
                  <span className="tabular-nums">
                    {row.onHandLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  Open on POs:{" "}
                  <span className="tabular-nums">
                    {row.onOrderOpenLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  Suggest buying:{" "}
                  <span className="font-semibold tabular-nums text-amber-900">
                    {row.suggestPurchaseLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    lin ft
                  </span>
                </div>
              </dl>
              {row.vendor?.trim() ? (
                <p className="mt-2 text-xs text-zinc-500">Vendor: {row.vendor}</p>
              ) : (
                <p className="mt-2 text-xs text-amber-800">Add a vendor on the film item before merging POs.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={newPoHref}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  New purchase order
                </Link>
                <Link
                  href={`/inventory/film/${row.filmInventoryId}`}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Film detail
                </Link>
                {row.vendor?.trim()
                  ? drafts.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => void addToDraft(d.id, row)}
                        className="rounded-lg border border-amber-700/50 bg-amber-100/80 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {busyKey === `${row.filmInventoryId}-${d.id}`
                          ? "Adding…"
                          : `Add to draft ${d.reference?.trim() || `${d.id.slice(0, 8)}…`}`}
                      </button>
                    ))
                  : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
