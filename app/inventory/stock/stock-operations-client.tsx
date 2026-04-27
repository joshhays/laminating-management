"use client";

import type { FilmStockKind, InventoryMovementType } from "@prisma/client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type FilmRow = {
  id: string;
  rollWidth: number;
  thicknessMil: number;
  materialType: string;
  materialTypeLabel?: string;
  description: string;
  stockKind: FilmStockKind;
  vendor: string | null;
  remainingLinearFeet: number;
};

type MovementRow = {
  id: string;
  type: InventoryMovementType;
  deltaLinearFeet: number;
  balanceAfterLinearFeet: number;
  note: string | null;
  createdAt: string;
};

function movementLabel(t: InventoryMovementType) {
  switch (t) {
    case "PO_RECEIVE":
      return "PO receive";
    case "HARD_COUNT":
      return "Hard count";
    case "MANUAL_DEDUCT":
      return "Manual deduct";
    case "JOB_PULL":
      return "Job pull";
    default:
      return t;
  }
}

export function StockOperationsClient() {
  const [rolls, setRolls] = useState<FilmRow[]>([]);
  const [rollId, setRollId] = useState("");
  const [hardCountFeet, setHardCountFeet] = useState("");
  const [deductFeet, setDeductFeet] = useState("");
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRolls = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/film-inventory");
      if (!res.ok) throw new Error("Failed to load rolls");
      const data = (await res.json()) as FilmRow[];
      setRolls(data);
      setRollId((cur) => cur || data[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMovements = useCallback(async (id: string) => {
    if (!id) {
      setMovements([]);
      return;
    }
    setMovementsLoading(true);
    try {
      const res = await fetch(`/api/film-inventory/${id}/movements`);
      if (!res.ok) throw new Error("Failed to load movements");
      setMovements((await res.json()) as MovementRow[]);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRolls();
  }, [loadRolls]);

  useEffect(() => {
    if (rollId) void loadMovements(rollId);
  }, [rollId, loadMovements]);

  const selected = rolls.find((r) => r.id === rollId);

  async function postAdjust(kind: "HARD_COUNT" | "MANUAL_DEDUCT", linearFeet: number) {
    if (!rollId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/film-inventory/${rollId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, linearFeet }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Adjust failed");
        return;
      }
      if (kind === "HARD_COUNT") setHardCountFeet("");
      if (kind === "MANUAL_DEDUCT") setDeductFeet("");
      await loadRolls();
      await loadMovements(rollId);
    } finally {
      setSaving(false);
    }
  }

  function onHardCount(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(hardCountFeet);
    if (!Number.isFinite(n) || n < 0) {
      setError("Enter a valid non-negative count.");
      return;
    }
    void postAdjust("HARD_COUNT", n);
  }

  function onDeduct(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(deductFeet);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive amount to deduct.");
      return;
    }
    void postAdjust("MANUAL_DEDUCT", n);
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading rolls…</p>;
  }

  return (
    <div className="space-y-10">
      <label className="block max-w-xl text-sm">
        <span className="font-medium text-zinc-800">Roll</span>
        <select
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          value={rollId}
          onChange={(e) => setRollId(e.target.value)}
        >
          {rolls.length === 0 ? (
            <option value="">No rolls</option>
          ) : (
            rolls.map((r) => (
              <option key={r.id} value={r.id}>
                {r.stockKind === "CATALOG" ? "[Catalog] " : ""}
                {r.vendor?.trim() ? `${r.vendor.trim()} · ` : ""}
                {r.description} · {r.materialTypeLabel ?? r.materialType} ·{" "}
                {r.remainingLinearFeet.toFixed(1)} lin. ft
              </option>
            ))
          )}
        </select>
      </label>

      {selected && (
        <p className="text-sm text-zinc-600">
          {selected.stockKind === "CATALOG" ? (
            <span className="font-medium text-violet-900">Catalog item — </span>
          ) : null}
          Current balance:{" "}
          <span className="font-semibold tabular-nums text-zinc-900">
            {selected.remainingLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
            lin. ft
          </span>
          {selected.vendor?.trim() ? (
            <>
              {" · Vendor: "}
              <span className="font-medium text-zinc-800">{selected.vendor.trim()}</span>
            </>
          ) : null}
          {" · "}
          <Link
            href={rollId ? `/inventory/film/${rollId}` : "/inventory"}
            className="font-medium text-zinc-800 underline hover:text-zinc-950"
          >
            Edit this roll (pricing, catalog / floor, dimensions)
          </Link>
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={(e) => void onHardCount(e)}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-medium text-zinc-900">Hard count</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Set remaining linear feet to the physically counted balance.
          </p>
          <input
            type="number"
            step="any"
            min={0}
            className="mt-4 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={hardCountFeet}
            onChange={(e) => setHardCountFeet(e.target.value)}
            placeholder="Counted lin. ft"
            disabled={!rollId || saving}
          />
          <button
            type="submit"
            disabled={!rollId || saving}
            className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Apply hard count
          </button>
        </form>

        <form
          onSubmit={(e) => void onDeduct(e)}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-medium text-zinc-900">Manual deduct</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Remove linear feet for scrap, samples, or unlogged use.
          </p>
          <input
            type="number"
            step="any"
            min={0}
            className="mt-4 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={deductFeet}
            onChange={(e) => setDeductFeet(e.target.value)}
            placeholder="Feet to deduct"
            disabled={!rollId || saving}
          />
          <button
            type="submit"
            disabled={!rollId || saving}
            className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            Deduct
          </button>
        </form>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-zinc-900">Recent movements</h2>
        {movementsLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : movements.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No movements for this roll yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <div>
                  <span className="font-medium text-zinc-900">{movementLabel(m.type)}</span>
                  {m.note && (
                    <span className="ml-2 text-zinc-600">
                      — {m.note}
                    </span>
                  )}
                </div>
                <div className="tabular-nums text-zinc-700">
                  Δ {m.deltaLinearFeet >= 0 ? "+" : ""}
                  {m.deltaLinearFeet.toFixed(2)} → balance {m.balanceAfterLinearFeet.toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
