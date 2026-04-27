"use client";

import { useState } from "react";

export function ShippingSettingsClient({
  initialPricePerSkidUsd,
  initialMaxStackHeightInches,
  initialMaxSkidWeightLbs,
}: {
  initialPricePerSkidUsd: number;
  initialMaxStackHeightInches: number;
  initialMaxSkidWeightLbs: number;
}) {
  const [price, setPrice] = useState(
    Number.isFinite(initialPricePerSkidUsd) ? String(initialPricePerSkidUsd) : "0",
  );
  const [maxH, setMaxH] = useState(
    Number.isFinite(initialMaxStackHeightInches) && initialMaxStackHeightInches > 0
      ? String(initialMaxStackHeightInches)
      : "40",
  );
  const [maxW, setMaxW] = useState(
    Number.isFinite(initialMaxSkidWeightLbs) && initialMaxSkidWeightLbs > 0
      ? String(initialMaxSkidWeightLbs)
      : "1500",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const nPrice = Number(price);
      const nH = Number(maxH);
      const nW = Number(maxW);
      const res = await fetch("/api/skid-pack-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricePerSkidUsd: nPrice,
          maxStackHeightInches: nH,
          maxSkidWeightLbs: nW,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Max stack height (inches)
          </span>
          <input
            required
            type="number"
            min={0.01}
            step="any"
            value={maxH}
            onChange={(e) => {
              setMaxH(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Max skid weight (lb)
          </span>
          <input
            required
            type="number"
            min={0.01}
            step="any"
            value={maxW}
            onChange={(e) => {
              setMaxW(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Price per outbound skid (USD)
        </span>
        <input
          required
          type="number"
          min={0}
          step="any"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setSaved(false);
          }}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </label>
      <p className="mt-4 text-xs leading-relaxed text-zinc-600">
        Estimates use each sheet&apos;s weight from GSM × sheet area; <strong>inbound</strong> skids use
        substrate weight only. <strong>Outbound</strong> (laminated) counts apply{" "}
        <strong className="text-zinc-800">+25%</strong> to that weight for film. Skid sheet counts are the
        minimum allowed by height and by weight.
      </p>
      {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
      {saved && <p className="mt-3 text-sm text-green-800">Saved.</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
