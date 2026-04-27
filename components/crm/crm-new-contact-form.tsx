"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CompanyRow = { id: string; name: string };

export function CrmNewContactForm() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/companies?take=200");
      const data = (await res.json()) as CompanyRow[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        setCompanies([]);
        return;
      }
      const rows = data.map((c) => ({ id: c.id, name: c.name }));
      setCompanies(rows);
      setCompanyId((prev) => prev || rows[0]?.id || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!companyId) {
      setError("Select an account.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase() || null,
          phone: phone.trim() || null,
          isPrimary,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create contact");
        return;
      }
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setIsPrimary(false);
      router.push(`/crm/accounts/${companyId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4"
    >
      <h2 className="text-sm font-medium text-zinc-900">New contact</h2>
      <p className="text-xs text-zinc-600">People at an account (print buyers, designers, AP, etc.).</p>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading accounts…</p>
      ) : companies.length === 0 ? (
        <p className="text-sm text-amber-800">Create an account first.</p>
      ) : (
        <>
          <label className="block text-sm">
            <span className="text-zinc-600">Account</span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-zinc-600">First name</span>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Last name</span>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-zinc-600">Email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Primary contact for this account
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add contact"}
          </button>
        </>
      )}
    </form>
  );
}
