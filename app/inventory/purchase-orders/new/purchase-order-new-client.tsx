"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type LineForm = {
  filmInventoryId?: string;
  materialType: string;
  description: string;
  thicknessMil: string;
  rollWidth: string;
  orderedLinearFeet: string;
};

const emptyLine = (materialType: string): LineForm => ({
  materialType,
  description: "",
  thicknessMil: "",
  rollWidth: "",
  orderedLinearFeet: "",
});

type Props = {
  prefillFilmId?: string;
  prefillFeet?: string;
};

export function PurchaseOrderNewClient({ prefillFilmId, prefillFeet }: Props) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>(() => [emptyLine("")]);
  const [typeOptions, setTypeOptions] = useState<{ code: string; label: string; active: boolean }[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/film-material-types")
      .then((r) => r.json())
      .then((data: Array<{ code: string; label: string; active: boolean }>) => {
        setTypeOptions(data);
        const first = data.find((d) => d.active);
        if (first) {
          setLines((L) =>
            L.map((row) =>
              row.materialType === "" ? { ...row, materialType: first.code } : row,
            ),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!prefillFilmId) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/film-inventory/${prefillFilmId}`);
      if (!res.ok || cancelled) return;
      const film = (await res.json()) as {
        vendor: string | null;
        materialType: string;
        description: string;
        thicknessMil: number;
        rollWidth: number;
      };
      if (cancelled) return;
      setSupplierName(film.vendor?.trim() ?? "");
      const ft =
        prefillFeet != null && String(prefillFeet).trim() !== "" && Number(prefillFeet) > 0
          ? String(prefillFeet)
          : "";
      setLines([
        {
          filmInventoryId: prefillFilmId,
          materialType: film.materialType,
          description: film.description,
          thicknessMil: String(film.thicknessMil),
          rollWidth: String(film.rollWidth),
          orderedLinearFeet: ft,
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [prefillFilmId, prefillFeet]);

  const activeOptions = typeOptions.filter((o) => o.active);

  function addLine() {
    const first = activeOptions[0]?.code ?? "";
    setLines((L) => [...L, emptyLine(first)]);
  }

  function updateLine(i: number, patch: Partial<LineForm>) {
    setLines((L) => L.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function removeLine(i: number) {
    setLines((L) => (L.length <= 1 ? L : L.filter((_, j) => j !== i)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.trim() || null,
          supplierName: supplierName.trim() || null,
          vendorEmail: vendorEmail.trim() || null,
          notes: notes.trim() || null,
          lines: lines.map((l) => ({
            filmInventoryId: l.filmInventoryId || null,
            materialType: l.materialType,
            description: l.description.trim(),
            thicknessMil: Number(l.thicknessMil),
            rollWidth: Number(l.rollWidth),
            orderedLinearFeet: Number(l.orderedLinearFeet),
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create PO");
        return;
      }
      const id = (data as { id?: string }).id;
      if (id) {
        router.push(`/inventory/purchase-orders/${id}`);
        return;
      }
      router.push("/inventory/purchase-orders");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Supplier</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Vendor name"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Vendor email (optional)</span>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={vendorEmail}
            onChange={(e) => setVendorEmail(e.target.value)}
            placeholder="For “Send to vendor”"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800">Reference</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="PO #, confirmation…"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-zinc-800">Notes</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Lines</h2>
          <button
            type="button"
            onClick={addLine}
            className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900"
          >
            Add line
          </button>
        </div>
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="block text-sm sm:col-span-2 lg:col-span-3">
              <span className="font-medium text-zinc-800">Description</span>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">Material</span>
              <select
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={line.materialType}
                onChange={(e) => updateLine(i, { materialType: e.target.value })}
                disabled={activeOptions.length === 0}
              >
                {activeOptions.length === 0 ? (
                  <option value="">Loading…</option>
                ) : (
                  activeOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label} ({opt.code})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">Thickness (mil)</span>
              <input
                required
                type="number"
                step="any"
                min={0.001}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={line.thicknessMil}
                onChange={(e) => updateLine(i, { thicknessMil: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">Roll width (in)</span>
              <input
                required
                type="number"
                step="any"
                min={0.001}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={line.rollWidth}
                onChange={(e) => updateLine(i, { rollWidth: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-zinc-800">Ordered linear ft</span>
              <input
                required
                type="number"
                step="any"
                min={0.001}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={line.orderedLinearFeet}
                onChange={(e) => updateLine(i, { orderedLinearFeet: e.target.value })}
              />
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-sm text-red-700 underline"
                >
                  Remove line
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || activeOptions.length === 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create purchase order"}
        </button>
        <Link
          href="/inventory/purchase-orders"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
