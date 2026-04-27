"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilmStockKind } from "@prisma/client";
import type { FilmOption } from "@/lib/estimate-film-option";
import { filmOptionLabel, filmOptionSearchText } from "@/lib/estimate-film-option";

type TypeOption = { code: string; label: string; active: boolean };

const addFormEmpty = {
  stockKind: "FLOOR_STOCK" as FilmStockKind,
  vendor: "",
  rollWidth: "",
  thicknessMil: "",
  materialType: "",
  description: "",
  remainingLinearFeet: "",
  pricePerFilmSquareInch: "",
};

export function FilmRollPicker({
  films,
  value,
  onChange,
  onRollCreated,
  allowEmpty = false,
  label = "Film roll",
}: {
  films: FilmOption[];
  value: string;
  onChange: (id: string) => void;
  /** Append the new roll to local list and typically select it. */
  onRollCreated: (roll: FilmOption) => void;
  allowEmpty?: boolean;
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [typeOptions, setTypeOptions] = useState<TypeOption[]>([]);
  const [addForm, setAddForm] = useState(addFormEmpty);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selected = films.find((f) => f.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return films;
    return films.filter((f) => filmOptionSearchText(f).includes(q));
  }, [films, query]);

  const loadTypes = useCallback(async () => {
    const res = await fetch("/api/film-material-types");
    if (!res.ok) return;
    const data = (await res.json()) as Array<{ code: string; label: string; active: boolean }>;
    setTypeOptions(data.map((r) => ({ code: r.code, label: r.label, active: r.active })));
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    setAddError(null);
    void loadTypes();
  }, [addOpen, loadTypes]);

  useEffect(() => {
    if (!addOpen || addForm.materialType || typeOptions.length === 0) return;
    const first = typeOptions.find((o) => o.active);
    if (first) setAddForm((f) => ({ ...f, materialType: first.code }));
  }, [addOpen, typeOptions, addForm.materialType]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function openList() {
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSaving(true);
    try {
      const res = await fetch("/api/film-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockKind: addForm.stockKind,
          vendor: addForm.vendor.trim() || null,
          rollWidth: addForm.rollWidth,
          thicknessMil: addForm.thicknessMil,
          materialType: addForm.materialType,
          description: addForm.description.trim(),
          remainingLinearFeet: addForm.remainingLinearFeet,
          pricePerFilmSquareInch: Number(addForm.pricePerFilmSquareInch || 0),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as FilmOption & { error?: string };
      if (!res.ok) {
        setAddError(typeof data.error === "string" ? data.error : "Could not add roll");
        return;
      }
      if (!data.id) {
        setAddError("Unexpected response");
        return;
      }
      const roll: FilmOption = {
        id: data.id,
        rollWidth: data.rollWidth,
        thicknessMil: data.thicknessMil,
        materialType: data.materialType,
        materialTypeLabel: data.materialTypeLabel,
        description: data.description,
        stockKind: data.stockKind,
        vendor: data.vendor ?? null,
        remainingLinearFeet: data.remainingLinearFeet,
        pricePerFilmSquareInch: data.pricePerFilmSquareInch,
      };
      onRollCreated(roll);
      pick(roll.id);
      setAddOpen(false);
      setAddForm({
        ...addFormEmpty,
        materialType: addForm.materialType,
      });
    } finally {
      setAddSaving(false);
    }
  }

  const typeChoices = typeOptions.filter((o) => o.active || o.code === addForm.materialType);

  return (
    <div ref={wrapRef} className="relative">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openList())}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <span className="min-w-0 truncate text-zinc-900">
            {selected ? filmOptionLabel(selected) : allowEmpty ? "— Select roll —" : "Choose a roll…"}
          </span>
          <span className="shrink-0 text-zinc-400" aria-hidden>
            ▾
          </span>
        </button>
      </div>
      {value ? (
        <p className="mt-1.5 text-xs text-zinc-500">
          <Link
            href={`/inventory/film/${value}`}
            className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
          >
            Edit film (catalog / floor, price, dimensions)
          </Link>
        </p>
      ) : null}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <div className="border-b border-zinc-100 px-2 pb-2 pt-1">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search type, description, width, mil…"
              className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              autoComplete="off"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {allowEmpty && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick("")}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  — Select roll —
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-zinc-500">No rolls match.</li>
            ) : (
              filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(r.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                      r.id === value ? "bg-zinc-100 font-medium" : ""
                    }`}
                  >
                    {filmOptionLabel(r)}
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-zinc-100 px-2 py-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                setAddOpen(true);
              }}
              className="w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
            >
              + Add new roll to inventory
            </button>
          </div>
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="film-add-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="film-add-title" className="text-lg font-semibold text-zinc-900">
              New film roll
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Saved to inventory and selected for this estimate. Manage types under{" "}
              <Link href="/inventory/material-types" className="font-medium underline">
                Film material types
              </Link>
              .
            </p>
            <form onSubmit={submitAdd} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-zinc-600">Stock / sourcing</span>
                <select
                  value={addForm.stockKind}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, stockKind: e.target.value as FilmStockKind }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="FLOOR_STOCK">On floor (physical roll)</option>
                  <option value="CATALOG">Catalog (order per job; not on floor)</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600">Vendor (optional)</span>
                <input
                  value={addForm.vendor}
                  onChange={(e) => setAddForm((f) => ({ ...f, vendor: e.target.value }))}
                  placeholder="e.g. D&K, Nobelus"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600">Material type</span>
                <select
                  required
                  value={addForm.materialType}
                  onChange={(e) => setAddForm((f) => ({ ...f, materialType: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  {typeChoices.length === 0 ? (
                    <option value="">Loading…</option>
                  ) : (
                    typeChoices.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label} ({o.code})
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600">Description</span>
                <input
                  required
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Matte scuff-resistant"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-zinc-600">Roll width (in)</span>
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    value={addForm.rollWidth}
                    onChange={(e) => setAddForm((f) => ({ ...f, rollWidth: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-600">Thickness (mil)</span>
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    value={addForm.thicknessMil}
                    onChange={(e) => setAddForm((f) => ({ ...f, thicknessMil: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-zinc-600">Linear ft on hand</span>
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    value={addForm.remainingLinearFeet}
                    onChange={(e) => setAddForm((f) => ({ ...f, remainingLinearFeet: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-600">Price / MSI ($)</span>
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    value={addForm.pricePerFilmSquareInch}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, pricePerFilmSquareInch: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
              </div>
              {addError ? <p className="text-sm text-red-700">{addError}</p> : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={addSaving}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {addSaving ? "Saving…" : "Save to inventory & use"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
