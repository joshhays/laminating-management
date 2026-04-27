"use client";

import type { CompanyType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TYPES: { value: CompanyType; label: string }[] = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "VENDOR", label: "Vendor" },
  { value: "ARCHIVED", label: "Archived" },
];

export function CrmNewAccountForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<CompanyType>("PROSPECT");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Account name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          website: website.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          creditLimit:
            creditLimit.trim() === "" || !Number.isFinite(Number(creditLimit))
              ? null
              : Number(creditLimit),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create account");
        return;
      }
      if (typeof data.id === "string") {
        router.push(`/crm/accounts/${data.id}`);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4"
    >
      <h2 className="text-sm font-medium text-zinc-900">New account</h2>
      <p className="text-xs text-zinc-600">
        Organizations (customers, prospects, vendors). Add contacts on the account page or below.
      </p>
      <label className="block text-sm">
        <span className="text-zinc-600">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. Pacific Graphics"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CompanyType)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Website (optional)</span>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Billing / ship address (optional)</span>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Credit limit USD (optional)</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Create account"}
      </button>
      <p className="text-xs text-zinc-500">
        Or start from <Link href="/estimate/new" className="underline">New estimate</Link>.
      </p>
    </form>
  );
}
