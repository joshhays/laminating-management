"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Row = { key: string; value: string };

function rowsFromObject(obj: Record<string, string> | null | undefined): Row[] {
  if (!obj) return [];
  return Object.entries(obj)
    .map(([key, value]) => ({ key, value: String(value) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function CustomFieldsEditor({
  title = "Custom fields",
  helper = "Add labels your team uses on quotes and jobs (e.g. preferred laminate, gate code). Stored as JSON — no deploy required.",
  initialMap,
  saveUrl,
  readOnly = false,
}: {
  title?: string;
  helper?: string;
  initialMap: Record<string, string> | null | undefined;
  saveUrl: string;
  /** When true, fields are display-only (e.g. job archived to reporting). */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const initialRows = useMemo(() => rowsFromObject(initialMap ?? undefined), [initialMap]);
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows.length > 0 ? initialRows : [{ key: "", value: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function addRow() {
    setRows((r) => [...r, { key: "", value: "" }]);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, j) => j !== i));
  }

  async function save() {
    setError(null);
    setNotice(null);
    const obj: Record<string, string> = {};
    for (const row of rows) {
      const k = row.key.trim();
      if (!k) continue;
      obj[k] = row.value;
    }
    setSaving(true);
    try {
      const res = await fetch(saveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: obj }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      setNotice("Saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const showTitle = title.trim() !== "";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      {showTitle ? (
        <h2 className="text-sm font-medium text-zinc-900">{title}</h2>
      ) : null}
      <p className={`text-xs text-zinc-600 ${showTitle ? "mt-1" : ""}`}>{helper}</p>
      {readOnly ? (
        <p className="mt-3 text-xs font-medium text-amber-900/80">Read-only — this job is complete and locked.</p>
      ) : null}
      <div className="mt-4 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={row.key}
              onChange={(e) => updateRow(i, { key: e.target.value })}
              placeholder="Field name"
              disabled={readOnly}
              className="min-w-[8rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-600"
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => updateRow(i, { value: e.target.value })}
              placeholder="Value"
              disabled={readOnly}
              className="min-w-[10rem] flex-[2] rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-600"
            />
            {!readOnly ? (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded-lg border border-zinc-200 px-2 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {!readOnly ? (
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Add field
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save custom fields"}
        </button>
      </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-2 text-sm text-emerald-800">{notice}</p> : null}
    </section>
  );
}
