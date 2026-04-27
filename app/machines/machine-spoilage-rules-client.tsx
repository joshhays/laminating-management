"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type SpoilageRuleRow = {
  sortOrder: number;
  name: string;
  paperBasis: "" | "TEXT" | "COVER";
  quantityMin: string;
  quantityMax: string;
  spoilagePercent: string;
};

function emptyRow(order: number): SpoilageRuleRow {
  return {
    sortOrder: order,
    name: "",
    paperBasis: "",
    quantityMin: "",
    quantityMax: "",
    spoilagePercent: "",
  };
}

function toRows(
  rules: Array<{
    sortOrder: number;
    name: string | null;
    paperBasis: "TEXT" | "COVER" | null;
    quantityMin: number | null;
    quantityMax: number | null;
    spoilagePercent: number;
  }>,
): SpoilageRuleRow[] {
  if (rules.length === 0) return [emptyRow(0)];
  return rules.map((r) => ({
    sortOrder: r.sortOrder,
    name: r.name ?? "",
    paperBasis: r.paperBasis === "TEXT" || r.paperBasis === "COVER" ? r.paperBasis : "",
    quantityMin: r.quantityMin != null ? String(r.quantityMin) : "",
    quantityMax: r.quantityMax != null ? String(r.quantityMax) : "",
    spoilagePercent: String(r.spoilagePercent),
  }));
}

type Props = {
  machineId: string;
  initialRules: Array<{
    sortOrder: number;
    name: string | null;
    paperBasis: "TEXT" | "COVER" | null;
    quantityMin: number | null;
    quantityMax: number | null;
    spoilagePercent: number;
  }>;
};

export function MachineSpoilageRulesClient({ machineId, initialRules }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(() => toRows(initialRules));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<SpoilageRuleRow>) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[i];
      if (!row) return prev;
      next[i] = { ...row, ...patch };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(prev.length)]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const rules = rows
      .map((r, i) => ({
        sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : i,
        name: r.name.trim() || null,
        paperBasis: r.paperBasis.trim() === "" ? null : r.paperBasis,
        quantityMin: r.quantityMin.trim() === "" ? null : Math.floor(Number(r.quantityMin)),
        quantityMax: r.quantityMax.trim() === "" ? null : Math.floor(Number(r.quantityMax)),
        spoilagePercent: Number(r.spoilagePercent),
      }))
      .filter((r) => {
        const emptyRow =
          (r.name == null || r.name === "") &&
          r.paperBasis == null &&
          r.quantityMin == null &&
          r.quantityMax == null &&
          (!Number.isFinite(r.spoilagePercent) || r.spoilagePercent === 0);
        return !emptyRow;
      })
      .filter(
        (r) =>
          Number.isFinite(r.spoilagePercent) &&
          r.spoilagePercent >= 0 &&
          r.spoilagePercent <= 100 &&
          !(r.quantityMin != null && (Number.isNaN(r.quantityMin) || r.quantityMin < 1)) &&
          !(r.quantityMax != null && (Number.isNaN(r.quantityMax) || r.quantityMax < 1)),
      );

    try {
      const res = await fetch(`/api/machines/${machineId}/spoilage-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-zinc-900">Spoilage by quantity</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Order quantity (sheets) is matched to the <strong>first</strong> rule whose min–max range
          contains it (by sort order) and whose basis type matches the estimate stock (or use Any).
          Leave min empty to treat as 1; leave max empty for no upper limit. If nothing matches, the
          machine&apos;s default spoilage % above is used. Two-sided estimates apply an extra 50% to
          the resolved spoilage % (e.g. 10% → 15%).
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-zinc-50 font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2 py-2">Sort</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Basis</th>
              <th className="px-2 py-2">Qty min</th>
              <th className="px-2 py-2">Qty max</th>
              <th className="px-2 py-2">Spoilage %</th>
              <th className="w-8 px-1 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={row.sortOrder}
                    onChange={(e) => updateRow(i, { sortOrder: Number(e.target.value) })}
                    className="w-14 rounded border border-zinc-300 px-1 py-1 tabular-nums"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    className="w-full min-w-[100px] rounded border border-zinc-300 px-1 py-1"
                    placeholder="Optional"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={row.paperBasis}
                    onChange={(e) =>
                      updateRow(i, {
                        paperBasis: e.target.value as SpoilageRuleRow["paperBasis"],
                      })
                    }
                    className="w-[108px] rounded border border-zinc-300 px-1 py-1"
                    aria-label="Paper basis"
                  >
                    <option value="">Any</option>
                    <option value="TEXT">Text</option>
                    <option value="COVER">Cover</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    min={1}
                    value={row.quantityMin}
                    onChange={(e) => updateRow(i, { quantityMin: e.target.value })}
                    className="w-20 rounded border border-zinc-300 px-1 py-1 tabular-nums"
                    placeholder="1 if empty"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    min={1}
                    value={row.quantityMax}
                    onChange={(e) => updateRow(i, { quantityMax: e.target.value })}
                    className="w-20 rounded border border-zinc-300 px-1 py-1 tabular-nums"
                    placeholder="∞ if empty"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={row.spoilagePercent}
                    onChange={(e) => updateRow(i, { spoilagePercent: e.target.value })}
                    className="w-16 rounded border border-zinc-300 px-1 py-1 tabular-nums"
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-red-700"
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800"
        >
          Add rule
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save spoilage rules"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
