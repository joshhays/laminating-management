"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type TypeRow = {
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

function emptyRow(order: number): TypeRow {
  return { code: "", label: "", sortOrder: order, active: true };
}

export function FilmMaterialTypesClient() {
  const router = useRouter();
  const [rows, setRows] = useState<TypeRow[]>([emptyRow(0)]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/film-material-types");
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as Array<{
        code: string;
        label: string;
        sortOrder: number;
        active: boolean;
      }>;
      if (data.length === 0) {
        setRows([emptyRow(0)]);
      } else {
        setRows(
          data.map((r) => ({
            code: r.code,
            label: r.label,
            sortOrder: r.sortOrder,
            active: r.active,
          })),
        );
      }
    } catch {
      setError("Could not load material types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function addRow() {
    const next =
      rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sortOrder), -1) + 1;
    setRows((R) => [...R, emptyRow(next)]);
  }

  function removeRow(i: number) {
    setRows((R) => (R.length <= 1 ? R : R.filter((_, j) => j !== i)));
  }

  function updateRow(i: number, patch: Partial<TypeRow>) {
    setRows((R) => R.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const payload = rows.filter((r) => r.code.trim() !== "" || r.label.trim() !== "");
      const res = await fetch("/api/film-material-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: payload.map((r) => ({
            code: r.code,
            label: r.label,
            sortOrder: r.sortOrder,
            active: r.active,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      setOk(true);
      await load();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading material types…</p>;
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
      <p className="text-sm text-zinc-600">
        Codes are stored on film rolls and purchase order lines (uppercase, letters, digits, underscore).
        You cannot remove a code that is still used on inventory or an open PO line. Inactive types stay
        valid on existing rolls but cannot be selected for new rolls.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Sort</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Active</th>
              <th className="w-14 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step={1}
                    className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums"
                    value={row.sortOrder}
                    onChange={(e) =>
                      updateRow(i, { sortOrder: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-36 rounded border border-zinc-300 px-2 py-1 font-mono text-xs uppercase"
                    value={row.code}
                    onChange={(e) => updateRow(i, { code: e.target.value })}
                    placeholder="PET"
                    spellCheck={false}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full min-w-[180px] rounded border border-zinc-300 px-2 py-1 text-sm"
                    value={row.label}
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    placeholder="Display name"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => updateRow(i, { active: e.target.checked })}
                    className="rounded border-zinc-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-xs text-red-700 underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-zinc-800 underline hover:text-zinc-950"
        >
          Add type
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save material types"}
        </button>
        <Link
          href="/inventory"
          className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back to film inventory
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-800">Saved.</p>}
    </form>
  );
}
