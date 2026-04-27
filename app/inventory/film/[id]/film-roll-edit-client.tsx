"use client";

import type { FilmStockKind } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FilmRow } from "@/app/inventory/film-inventory-client";
import { filmMaterialTypeLabel } from "@/lib/film-material-type";

type TypeOption = { code: string; label: string; active: boolean };

function optionsForSelect(all: TypeOption[], currentCode: string): TypeOption[] {
  return all.filter((o) => o.active || o.code === currentCode);
}

export function FilmRollEditClient({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeOptions, setTypeOptions] = useState<TypeOption[]>([]);
  const [initial, setInitial] = useState<FilmRow | null>(null);
  const [form, setForm] = useState({
    stockKind: "FLOOR_STOCK" as FilmStockKind,
    vendor: "",
    rollWidth: "",
    thicknessMil: "",
    materialType: "",
    description: "",
    remainingLinearFeet: "",
    pricePerFilmSquareInch: "",
  });

  const labelMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of typeOptions) m[o.code] = o.label;
    return m;
  }, [typeOptions]);

  const loadTypes = useCallback(async () => {
    const res = await fetch("/api/film-material-types");
    if (!res.ok) return;
    const data = (await res.json()) as Array<{ code: string; label: string; active: boolean }>;
    setTypeOptions(data.map((r) => ({ code: r.code, label: r.label, active: r.active })));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [invRes] = await Promise.all([fetch(`/api/film-inventory/${id}`), loadTypes()]);
      if (!invRes.ok) {
        throw new Error(invRes.status === 404 ? "Film item not found." : "Failed to load");
      }
      const row = (await invRes.json()) as FilmRow;
      setInitial(row);
      setForm({
        stockKind: row.stockKind,
        vendor: row.vendor ?? "",
        rollWidth: String(row.rollWidth),
        thicknessMil: String(row.thicknessMil),
        materialType: row.materialType,
        description: row.description,
        remainingLinearFeet: String(row.remainingLinearFeet),
        pricePerFilmSquareInch: String(row.pricePerFilmSquareInch ?? 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setInitial(null);
    } finally {
      setLoading(false);
    }
  }, [id, loadTypes]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/film-inventory/${id}`, {
        method: "PATCH",
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
      await load();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this film item from inventory? Estimates that reference it may break.")) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/film-inventory/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete");
      return;
    }
    router.push("/inventory");
    router.refresh();
  }

  const typeChoices = optionsForSelect(typeOptions, form.materialType);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading…</p>;
  }

  if (!initial) {
    return (
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <Link
          href="/inventory"
          className="text-sm font-medium text-zinc-800 underline hover:text-zinc-950"
        >
          ← Back to inventory
        </Link>
      </div>
    );
  }

  const kindLabel =
    initial.stockKind === "CATALOG" ? (
      <span className="font-medium text-violet-800">Catalog (order per job; not on floor)</span>
    ) : (
      <span className="font-medium text-emerald-900">On-floor stock (physical roll)</span>
    );

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600">
        Currently: {kindLabel}
        {" · "}
        Type:{" "}
        {initial.materialTypeLabel ?? filmMaterialTypeLabel(initial.materialType, labelMap)} (
        {initial.materialType})
      </p>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => void handleSave(e)}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Stock / sourcing
          </span>
          <select
            value={form.stockKind}
            onChange={(e) =>
              setForm((f) => ({ ...f, stockKind: e.target.value as FilmStockKind }))
            }
            className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="FLOOR_STOCK">On floor (physical roll)</option>
            <option value="CATALOG">Catalog (order per job)</option>
          </select>
          <p className="mt-1 text-[11px] text-zinc-500">
            Switch between on-hand roll and catalog-only pricing without creating a new item.
          </p>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Vendor</span>
          <input
            value={form.vendor}
            onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            placeholder="Optional"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Material type
          </span>
          <select
            required
            value={form.materialType}
            onChange={(e) => setForm((f) => ({ ...f, materialType: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {typeChoices.length === 0 ? (
              <option value="">Loading types…</option>
            ) : (
              typeChoices.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label} ({o.code})
                  {!o.active ? " — inactive" : ""}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Description
          </span>
          <input
            required
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
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
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
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
            onChange={(e) => setForm((f) => ({ ...f, thicknessMil: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
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
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            $ / MSI (1000 sq in)
          </span>
          <input
            type="number"
            min={0}
            step="any"
            value={form.pricePerFilmSquareInch}
            onChange={(e) =>
              setForm((f) => ({ ...f, pricePerFilmSquareInch: e.target.value }))
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={saving || typeChoices.length === 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
          >
            Delete item
          </button>
        </div>
      </form>
    </div>
  );
}
