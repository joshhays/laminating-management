"use client";

import type { EstimatePaperColor } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STOCK_TYPE_OPTIONS } from "@/lib/stock-type-options";

const PRINT_PRESETS = ["Offset", "Digital", "UV", "Inkjet", "Flexo", "Screen"];

export type ReductionRuleRow = {
  sortOrder: number;
  name: string;
  paperGsmMin: string;
  paperGsmMax: string;
  stockType: string;
  printType: string;
  paperColor: "*" | "WHITE" | "COLORED";
  filmMaterialType: string;
  quantityMin: string;
  quantityMax: string;
  sheetWidthMinInches: string;
  sheetWidthMaxInches: string;
  sheetLengthMinInches: string;
  sheetLengthMaxInches: string;
  slowdownPercent: string;
};

function emptyRow(order: number): ReductionRuleRow {
  return {
    sortOrder: order,
    name: "",
    paperGsmMin: "",
    paperGsmMax: "",
    stockType: "*",
    printType: "*",
    paperColor: "*",
    filmMaterialType: "*",
    quantityMin: "",
    quantityMax: "",
    sheetWidthMinInches: "",
    sheetWidthMaxInches: "",
    sheetLengthMinInches: "",
    sheetLengthMaxInches: "",
    slowdownPercent: "",
  };
}

function toRows(
  rules: Array<{
    sortOrder: number;
    name: string | null;
    paperGsmMin: number | null;
    paperGsmMax: number | null;
    stockType: string | null;
    printType: string | null;
    paperColor: EstimatePaperColor | null;
    filmMaterialType: string | null;
    quantityMin: number | null;
    quantityMax: number | null;
    sheetWidthMinInches: number | null;
    sheetWidthMaxInches: number | null;
    sheetLengthMinInches: number | null;
    sheetLengthMaxInches: number | null;
    slowdownPercent: number;
  }>,
): ReductionRuleRow[] {
  if (rules.length === 0) return [emptyRow(0)];
  return rules.map((r) => ({
    sortOrder: r.sortOrder,
    name: r.name ?? "",
    paperGsmMin: r.paperGsmMin != null ? String(r.paperGsmMin) : "",
    paperGsmMax: r.paperGsmMax != null ? String(r.paperGsmMax) : "",
    stockType: r.stockType ?? "*",
    printType: r.printType ?? "*",
    paperColor: r.paperColor == null ? "*" : r.paperColor,
    filmMaterialType: r.filmMaterialType ?? "*",
    quantityMin: r.quantityMin != null ? String(r.quantityMin) : "",
    quantityMax: r.quantityMax != null ? String(r.quantityMax) : "",
    sheetWidthMinInches: r.sheetWidthMinInches != null ? String(r.sheetWidthMinInches) : "",
    sheetWidthMaxInches: r.sheetWidthMaxInches != null ? String(r.sheetWidthMaxInches) : "",
    sheetLengthMinInches: r.sheetLengthMinInches != null ? String(r.sheetLengthMinInches) : "",
    sheetLengthMaxInches: r.sheetLengthMaxInches != null ? String(r.sheetLengthMaxInches) : "",
    slowdownPercent: String(r.slowdownPercent),
  }));
}

type Props = {
  machineId: string;
  initialRules: Array<{
    sortOrder: number;
    name: string | null;
    paperGsmMin: number | null;
    paperGsmMax: number | null;
    stockType: string | null;
    printType: string | null;
    paperColor: EstimatePaperColor | null;
    filmMaterialType: string | null;
    quantityMin: number | null;
    quantityMax: number | null;
    sheetWidthMinInches: number | null;
    sheetWidthMaxInches: number | null;
    sheetLengthMinInches: number | null;
    sheetLengthMaxInches: number | null;
    slowdownPercent: number;
  }>;
};

function StockSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isAny = value === "*" || value === "";
  const preset = STOCK_TYPE_OPTIONS.some((o) => o.value === value);
  const selectValue = isAny ? "*" : preset ? value : "__custom__";
  return (
    <div className="flex flex-col gap-1">
      <select
        className="max-w-[120px] rounded border border-zinc-300 px-1 py-1 text-xs"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") onChange("");
          else onChange(v);
        }}
      >
        <option value="*">Any (*)</option>
        {STOCK_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {!isAny && !preset && (
        <input
          className="w-full max-w-[120px] rounded border border-zinc-300 px-1 py-0.5 text-xs"
          placeholder="Type"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function PrintSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isAny = value === "*";
  const preset = PRINT_PRESETS.includes(value);
  return (
    <div className="flex flex-col gap-1">
      <select
        className="max-w-[110px] rounded border border-zinc-300 px-1 py-1 text-xs"
        value={isAny ? "*" : preset ? value : "__custom__"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") onChange("");
          else onChange(v);
        }}
      >
        <option value="*">Any (*)</option>
        {PRINT_PRESETS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {!isAny && !preset && (
        <input
          className="w-full max-w-[110px] rounded border border-zinc-300 px-1 py-0.5 text-xs"
          placeholder="Print"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function FilmSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { code: string; label: string }[];
}) {
  const isAny = value === "*" || value === "";
  const known = options.some((o) => o.code === value);
  return (
    <div className="flex flex-col gap-1">
      <select
        className="max-w-[130px] rounded border border-zinc-300 px-1 py-1 text-xs"
        value={isAny ? "__any__" : known ? value : "__custom__"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__any__") onChange("*");
          else if (v === "__custom__") onChange("");
          else onChange(v);
        }}
      >
        <option value="__any__">Any (*)</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {!isAny && !known && (
        <input
          className="w-full max-w-[130px] rounded border border-zinc-300 px-1 py-0.5 font-mono text-[10px] uppercase"
          placeholder="CODE"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      )}
    </div>
  );
}

export function MachineSpeedReductionRulesClient({ machineId, initialRules }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ReductionRuleRow[]>(() => toRows(initialRules));
  const [filmOptions, setFilmOptions] = useState<{ code: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    void fetch("/api/film-material-types")
      .then((r) => r.json())
      .then((data: Array<{ code: string; label: string }>) => {
        setFilmOptions(data.map((d) => ({ code: d.code, label: d.label })));
      })
      .catch(() => setFilmOptions([]));
  }, []);

  function addRow() {
    const nextOrder =
      rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sortOrder), -1) + 1;
    setRows((R) => [...R, emptyRow(nextOrder)]);
  }

  function removeRow(i: number) {
    setRows((R) => (R.length <= 1 ? R : R.filter((_, j) => j !== i)));
  }

  function updateRow(i: number, patch: Partial<ReductionRuleRow>) {
    setRows((R) => R.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const payload = rows
        .filter((r) => r.slowdownPercent.trim() !== "")
        .map((r) => ({
          sortOrder: r.sortOrder,
          name: r.name.trim() || null,
          paperGsmMin: r.paperGsmMin.trim() === "" ? null : Number(r.paperGsmMin),
          paperGsmMax: r.paperGsmMax.trim() === "" ? null : Number(r.paperGsmMax),
          stockType: r.stockType.trim() === "" || r.stockType === "*" ? null : r.stockType.trim(),
          printType: r.printType.trim() === "" || r.printType === "*" ? null : r.printType.trim(),
          paperColor: r.paperColor === "*" || r.paperColor.trim() === "" ? null : r.paperColor.trim(),
          filmMaterialType:
            r.filmMaterialType.trim() === "" || r.filmMaterialType === "*"
              ? null
              : r.filmMaterialType.trim().toUpperCase(),
          quantityMin: r.quantityMin.trim() === "" ? null : Math.floor(Number(r.quantityMin)),
          quantityMax: r.quantityMax.trim() === "" ? null : Math.floor(Number(r.quantityMax)),
          sheetWidthMinInches:
            r.sheetWidthMinInches.trim() === "" ? null : Number(r.sheetWidthMinInches),
          sheetWidthMaxInches:
            r.sheetWidthMaxInches.trim() === "" ? null : Number(r.sheetWidthMaxInches),
          sheetLengthMinInches:
            r.sheetLengthMinInches.trim() === "" ? null : Number(r.sheetLengthMinInches),
          sheetLengthMaxInches:
            r.sheetLengthMaxInches.trim() === "" ? null : Number(r.sheetLengthMaxInches),
          slowdownPercent: Number(r.slowdownPercent),
        }));

      const res = await fetch(`/api/machines/${machineId}/speed-reductions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: payload }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      setOk(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">Speed reduction rules</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Line speed starts at the machine max (m/min). Each matching row contributes its slowdown % at
            a stacking weight: 1st match 100%, 2nd 50%, 3rd 25%, 4th 12.5%, and so on. Σ is capped at
            &quot;max total slowdown&quot; above (0–100%, default 100). Empty fields and * mean
            &quot;any&quot;. Sheet width/length are the estimate dimensions (in).
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-zinc-800 underline hover:text-zinc-950"
        >
          Add row
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[1280px] text-left text-xs">
          <thead className="bg-zinc-50 font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-1 py-2">Ord</th>
              <th className="px-1 py-2">Name</th>
              <th className="px-1 py-2">Slow %</th>
              <th className="px-1 py-2">GSM min</th>
              <th className="px-1 py-2">GSM max</th>
              <th className="px-1 py-2">Stock</th>
              <th className="px-1 py-2">Print</th>
              <th className="px-1 py-2">Color</th>
              <th className="px-1 py-2">Film</th>
              <th className="px-1 py-2">Qty ≥</th>
              <th className="px-1 py-2">Qty ≤</th>
              <th className="px-1 py-2">W min</th>
              <th className="px-1 py-2">W max</th>
              <th className="px-1 py-2">L min</th>
              <th className="px-1 py-2">L max</th>
              <th className="w-14 px-1 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step={1}
                    className="w-12 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.sortOrder}
                    onChange={(e) =>
                      updateRow(i, { sortOrder: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-24 rounded border border-zinc-300 px-1 py-0.5"
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="—"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.slowdownPercent}
                    onChange={(e) => updateRow(i, { slowdownPercent: e.target.value })}
                    placeholder="0–100"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    className="w-16 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.paperGsmMin}
                    onChange={(e) => updateRow(i, { paperGsmMin: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    className="w-16 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.paperGsmMax}
                    onChange={(e) => updateRow(i, { paperGsmMax: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <StockSelect
                    value={row.stockType}
                    onChange={(v) => updateRow(i, { stockType: v })}
                  />
                </td>
                <td className="px-1 py-1">
                  <PrintSelect
                    value={row.printType}
                    onChange={(v) => updateRow(i, { printType: v })}
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    className="max-w-[5.5rem] rounded border border-zinc-300 px-1 py-0.5 text-xs"
                    value={row.paperColor}
                    onChange={(e) =>
                      updateRow(i, { paperColor: e.target.value as ReductionRuleRow["paperColor"] })
                    }
                    aria-label="Paper color"
                  >
                    <option value="*">Any</option>
                    <option value="WHITE">White</option>
                    <option value="COLORED">Colored</option>
                  </select>
                </td>
                <td className="px-1 py-1">
                  <FilmSelect
                    value={row.filmMaterialType}
                    onChange={(v) => updateRow(i, { filmMaterialType: v })}
                    options={filmOptions}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="—"
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5"
                    value={row.quantityMin}
                    onChange={(e) => updateRow(i, { quantityMin: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="—"
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5"
                    value={row.quantityMax}
                    onChange={(e) => updateRow(i, { quantityMax: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="—"
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.sheetWidthMinInches}
                    onChange={(e) => updateRow(i, { sheetWidthMinInches: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="—"
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.sheetWidthMaxInches}
                    onChange={(e) => updateRow(i, { sheetWidthMaxInches: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="—"
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.sheetLengthMinInches}
                    onChange={(e) => updateRow(i, { sheetLengthMinInches: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="—"
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5 tabular-nums"
                    value={row.sheetLengthMaxInches}
                    onChange={(e) => updateRow(i, { sheetLengthMaxInches: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-[10px] text-red-700 underline"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-800">Speed reduction rules saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save rules"}
      </button>
    </form>
  );
}
