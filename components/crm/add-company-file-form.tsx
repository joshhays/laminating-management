"use client";

import type { CompanyFileKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const KIND_OPTIONS: { value: CompanyFileKind; label: string }[] = [
  { value: "LOGO", label: "Logo" },
  { value: "BRAND_GUIDELINES", label: "Brand guidelines" },
  { value: "OTHER", label: "Other" },
];

export function AddCompanyFileForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<CompanyFileKind>("OTHER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), label: label.trim() || null, kind }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save file");
        return;
      }
      setUrl("");
      setLabel("");
      setKind("OTHER");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Add file / link</p>
      <label className="block text-sm">
        <span className="text-zinc-600">URL</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Label (optional)</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Type</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as CompanyFileKind)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add link"}
      </button>
    </form>
  );
}
