"use client";

import type { FilmStockKind } from "@prisma/client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filmMaterialTypeLabel } from "@/lib/film-material-type";

export type FilmRow = {
  id: string;
  rollWidth: number;
  thicknessMil: number;
  materialType: string;
  materialTypeLabel?: string;
  description: string;
  stockKind: FilmStockKind;
  vendor: string | null;
  remainingLinearFeet: number;
  pricePerFilmSquareInch: number;
  createdAt: string;
  updatedAt: string;
  /** From GET /api/film-inventory rollups */
  inEstimateCount?: number;
  allocatedToJobLinearFeet?: number;
  onOrderOpenLinearFeet?: number;
  onHandLinearFeet?: number;
  availableLinearFeet?: number;
};

type TypeOption = { code: string; label: string; active: boolean };

const emptyForm = {
  stockKind: "FLOOR_STOCK" as FilmStockKind,
  vendor: "",
  rollWidth: "",
  thicknessMil: "",
  materialType: "",
  description: "",
  remainingLinearFeet: "",
  pricePerFilmSquareInch: "",
};

function optionsForSelect(all: TypeOption[], currentCode: string): TypeOption[] {
  return all.filter((o) => o.active || o.code === currentCode);
}

export function FilmInventoryClient() {
  const [items, setItems] = useState<FilmRow[]>([]);
  const [typeOptions, setTypeOptions] = useState<TypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<"ALL" | FilmStockKind>("ALL");

  const labelMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of typeOptions) m[o.code] = o.label;
    return m;
  }, [typeOptions]);

  const loadTypes = useCallback(async () => {
    const res = await fetch("/api/film-material-types");
    if (!res.ok) return;
    const data = (await res.json()) as Array<{
      code: string;
      label: string;
      active: boolean;
    }>;
    setTypeOptions(data.map((r) => ({ code: r.code, label: r.label, active: r.active })));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [invRes] = await Promise.all([
        fetch("/api/film-inventory"),
        loadTypes(),
      ]);
      if (!invRes.ok) throw new Error("Failed to load inventory");
      const data = (await invRes.json()) as FilmRow[];
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadTypes]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (form.materialType || typeOptions.length === 0) return;
    const first = typeOptions.find((o) => o.active);
    if (first) {
      setForm((f) => ({ ...f, materialType: first.code }));
    }
  }, [typeOptions, form.materialType]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/film-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockKind: form.stockKind,
          vendor: form.vendor.trim() || null,
          rollWidth: form.rollWidth,
          thicknessMil: form.thicknessMil,
          materialType: form.materialType,
          description: form.description,
          remainingLinearFeet: form.remainingLinearFeet,
          pricePerFilmSquareInch: Number(form.pricePerFilmSquareInch || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      setForm({ ...emptyForm, materialType: form.materialType, stockKind: form.stockKind });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this film roll from inventory?")) return;
    setError(null);
    const res = await fetch(`/api/film-inventory/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete");
      return;
    }
    await load();
  }

  function downloadExport() {
    void (async () => {
      try {
        const res = await fetch("/api/film-inventory/export");
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const cd = res.headers.get("Content-Disposition");
        const match = cd?.match(/filename="([^"]+)"/);
        const fallback = `film-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
        const filename = match?.[1] ?? fallback;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("Could not download export.");
      }
    })();
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setError(null);
    setImportSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/film-inventory/import", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: number;
        updated?: number;
        errors?: { row: number; message: string }[];
      };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Import failed");
        return;
      }
      const parts: string[] = [];
      if (typeof data.created === "number") parts.push(`${data.created} added`);
      if (typeof data.updated === "number") parts.push(`${data.updated} updated`);
      if (data.errors && data.errors.length > 0) {
        parts.push(
          `${data.errors.length} row(s) skipped: ${data.errors
            .slice(0, 5)
            .map((x) => `row ${x.row}: ${x.message}`)
            .join("; ")}${data.errors.length > 5 ? "…" : ""}`,
        );
      }
      setImportSummary(parts.join(" · ") || "Done.");
      await load();
    } finally {
      setImporting(false);
    }
  }

  const createSelectOptions = optionsForSelect(typeOptions, form.materialType);

  const filteredItems = useMemo(() => {
    if (tableFilter === "ALL") return items;
    return items.filter((r) => r.stockKind === tableFilter);
  }, [items, tableFilter]);

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-zinc-900">Import / export</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Export is a CSV of all items (including <code className="text-xs">id</code>). Columns include{" "}
          <code className="text-xs">stockKind</code> (<code className="text-xs">FLOOR_STOCK</code> or{" "}
          <code className="text-xs">CATALOG</code>) and <code className="text-xs">vendor</code>. Older
          exports without those columns still import: they default to on-floor stock. Re-import the same
          file to update rows; rows without a matching id are added.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={downloadExport}
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Download CSV
          </button>
          <label className="inline-flex cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={importing}
              onChange={(ev) => void handleImportCsv(ev)}
            />
            {importing ? "Importing…" : "Import CSV"}
          </label>
        </div>
        {importSummary && (
          <p className="mt-3 text-sm text-zinc-700">Last import: {importSummary}</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-zinc-900">Add film item</h2>
        <form
          onSubmit={handleCreate}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Stock / sourcing
            </span>
            <select
              value={form.stockKind}
              onChange={(e) =>
                setForm((f) => ({ ...f, stockKind: e.target.value as FilmStockKind }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="FLOOR_STOCK">On floor (physical roll)</option>
              <option value="CATALOG">Catalog (order per job)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Vendor
            </span>
            <input
              value={form.vendor}
              onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Optional"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Material type
            </span>
            <select
              required
              value={form.materialType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  materialType: e.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            >
              {createSelectOptions.length === 0 ? (
                <option value="">Loading types…</option>
              ) : (
                createSelectOptions.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label} ({o.code})
                    {!o.active ? " — inactive" : ""}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Description
            </span>
            <input
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="e.g. Matte scuff-resistant, Gloss UV, Soft-touch"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Roll width (in)
            </span>
            <input
              required
              type="number"
              min={0}
              step="any"
              value={form.rollWidth}
              onChange={(e) => setForm((f) => ({ ...f, rollWidth: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="Across web"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Thickness (mil)
            </span>
            <input
              required
              type="number"
              min={0}
              step="any"
              value={form.thicknessMil}
              onChange={(e) =>
                setForm((f) => ({ ...f, thicknessMil: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="1 mil = 0.001 in"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Remaining linear ft
            </span>
            <input
              required
              type="number"
              min={0}
              step="any"
              value={form.remainingLinearFeet}
              onChange={(e) =>
                setForm((f) => ({ ...f, remainingLinearFeet: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="On roll"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              $ / MSI (1000 sq in, off roll)
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={form.pricePerFilmSquareInch}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pricePerFilmSquareInch: e.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
              placeholder="0"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving || createSelectOptions.length === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add to inventory"}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Film inventory &amp; catalog</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Use the first column (Edit) on any row. If the table is wide, scroll horizontally — Actions stay on the left.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                ["ALL", "All"],
                ["FLOOR_STOCK", "On floor"],
                ["CATALOG", "Catalog"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTableFilter(key)}
                className={`rounded-full border px-3 py-1 font-medium ${
                  tableFilter === key
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-sm text-zinc-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500">No film items yet. Add one above.</p>
        ) : filteredItems.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500">Nothing in this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1680px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="min-w-[140px] px-4 py-3">Description</th>
                  <th className="px-4 py-3">Roll (in)</th>
                  <th className="px-4 py-3">Mil</th>
                  <th className="px-4 py-3">On hand</th>
                  <th className="px-4 py-3">In est.</th>
                  <th className="px-4 py-3">On order</th>
                  <th className="px-4 py-3">Alloc. job</th>
                  <th className="px-4 py-3">Avail.</th>
                  <th className="px-4 py-3">$/MSI</th>
                  <th className="w-36 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredItems.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 text-zinc-700">
                      {row.stockKind === "CATALOG" ? (
                        <span className="font-medium text-violet-800">Catalog</span>
                      ) : (
                        <span className="font-medium text-emerald-900">On floor</span>
                      )}
                    </td>
                    <td
                      className="max-w-[140px] truncate px-4 py-3 text-zinc-700"
                      title={row.vendor ?? undefined}
                    >
                      {row.vendor?.trim() ? row.vendor : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {row.materialTypeLabel ??
                        filmMaterialTypeLabel(row.materialType, labelMap)}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3 font-medium text-zinc-900"
                      title={row.description}
                    >
                      {row.description}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">{row.rollWidth}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">{row.thicknessMil}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">
                      {row.onHandLinearFeet ?? row.remainingLinearFeet}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">
                      {row.inEstimateCount ?? 0}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">
                      {(row.onOrderOpenLinearFeet ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">
                      {(row.allocatedToJobLinearFeet ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-800">
                      {(row.availableLinearFeet ?? Math.max(0, row.remainingLinearFeet)).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 1 },
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">
                      $
                      {(row.pricePerFilmSquareInch ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/inventory/film/${row.id}`}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => void remove(row.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
