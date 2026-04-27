"use client";

import type { Company, CompanyType, Contact, PriceTier } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { crmContextFromRows, type CrmEstimateContext } from "@/lib/crm-estimate-context";

type CompanyWithContacts = Company & { contacts: Contact[] };

function primaryOrFirstContact(contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;
  return contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
}

function priceTierLabel(t: PriceTier | null): string {
  if (!t) return "—";
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export function CompanyEstimateStep({
  onContinue,
}: {
  onContinue: (ctx: CrmEstimateContext) => void;
}) {
  const [companies, setCompanies] = useState<CompanyWithContacts[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CompanyWithContacts | null>(null);
  const [contactId, setContactId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalType, setModalType] = useState<CompanyType>("PROSPECT");
  const [modalAddress, setModalAddress] = useState("");
  const [modalCredit, setModalCredit] = useState("");
  const [modalBalance, setModalBalance] = useState("");
  const [modalCf, setModalCf] = useState("");
  const [modalCl, setModalCl] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalPhone, setModalPhone] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [qcFirst, setQcFirst] = useState("");
  const [qcLast, setQcLast] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcPhone, setQcPhone] = useState("");
  const [qcSaving, setQcSaving] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url =
        q.trim().length > 0
          ? `/api/companies?q=${encodeURIComponent(q.trim())}&take=40`
          : "/api/companies?take=40";
      const res = await fetch(url);
      const data = (await res.json()) as CompanyWithContacts[] | { error?: string };
      if (!res.ok) {
        setError(typeof (data as { error?: string }).error === "string" ? (data as { error: string }).error : "Load failed");
        return;
      }
      setCompanies(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search), search.trim() ? 200 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const filteredOpen = search.length > 0 || companies.length > 0;

  const selectedContact = useMemo(() => {
    if (!selected) return null;
    if (!contactId) return primaryOrFirstContact(selected.contacts);
    return selected.contacts.find((c) => c.id === contactId) ?? null;
  }, [selected, contactId]);

  async function handleModalCreate(e: React.FormEvent) {
    e.preventDefault();
    setModalSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modalName.trim(),
          type: modalType,
          address: modalAddress.trim() || null,
          creditLimit: modalCredit.trim() === "" ? null : Number(modalCredit),
          outstandingBalance: modalBalance.trim() === "" ? 0 : Number(modalBalance),
        }),
      });
      const data = (await res.json()) as CompanyWithContacts & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create company");
        return;
      }
      let withContacts = data;
      if (modalCf.trim() && modalCl.trim()) {
        const cr = await fetch(`/api/companies/${data.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: modalCf.trim(),
            lastName: modalCl.trim(),
            email: modalEmail.trim() || null,
            phone: modalPhone.trim() || null,
            isPrimary: true,
          }),
        });
        const ct = await cr.json();
        if (!cr.ok) {
          setError(typeof ct.error === "string" ? ct.error : "Company created but contact failed");
        } else {
          withContacts = { ...data, contacts: [ct as Contact] };
        }
      }
      setModalOpen(false);
      setModalName("");
      setModalAddress("");
      setModalCredit("");
      setModalBalance("");
      setModalCf("");
      setModalCl("");
      setModalEmail("");
      setModalPhone("");
      await load("");
      setSelected(withContacts);
      setContactId(primaryOrFirstContact(withContacts.contacts)?.id ?? "");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleQuickContact(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setQcSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${selected.id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: qcFirst.trim(),
          lastName: qcLast.trim(),
          email: qcEmail.trim() || null,
          phone: qcPhone.trim() || null,
          isPrimary: selected.contacts.length === 0,
        }),
      });
      const ct = (await res.json()) as Contact & { error?: string };
      if (!res.ok) {
        setError(typeof ct.error === "string" ? ct.error : "Could not add contact");
        return;
      }
      const updated = { ...selected, contacts: [...selected.contacts, ct] };
      setSelected(updated);
      setContactId(ct.id);
      setQuickContactOpen(false);
      setQcFirst("");
      setQcLast("");
      setQcEmail("");
      setQcPhone("");
      await load(search);
    } finally {
      setQcSaving(false);
    }
  }

  function handleContinue() {
    if (!selected || !selectedContact) {
      setError("Select a company and contact.");
      return;
    }
    onContinue(crmContextFromRows(selected, selectedContact));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Step 1 — Company &amp; contact</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Search existing customers or add one. Estimates are tied to a company and a contact for quotes
          and follow-up.
        </p>
      </div>

      <div className="relative space-y-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Company</span>
          <input
            type="text"
            value={selected ? selected.name : search}
            onChange={(e) => {
              const v = e.target.value;
              if (selected && v !== selected.name) {
                setSelected(null);
                setContactId("");
                setSearch(v);
              } else {
                setSearch(v);
              }
            }}
            onFocus={() => {
              if (selected) {
                setSelected(null);
               setContactId("");
                setSearch(selected.name);
              }
            }}
            placeholder="Type to search companies…"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            autoComplete="off"
          />
        </label>
        {loading && <p className="text-xs text-zinc-500">Searching…</p>}
        {filteredOpen && !selected && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg">
            {companies.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    setSearch("");
                    setContactId(primaryOrFirstContact(c.contacts)?.id ?? "");
                  }}
                  className="flex w-full px-3 py-2 text-left hover:bg-zinc-50"
                >
                  <span className="font-medium text-zinc-900">{c.name}</span>
                  <span className="ml-2 text-zinc-500">{c.type}</span>
                </button>
              </li>
            ))}
            {companies.length === 0 && !loading && (
              <li className="px-3 py-2 text-zinc-500">No matches — try Add new company.</li>
            )}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900"
      >
        + Add new company
      </button>

      {selected && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm">
          <p className="font-medium text-zinc-900">{selected.name}</p>
          {selected.address ? (
            <p className="mt-1 whitespace-pre-wrap text-zinc-700">{selected.address}</p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            Price tier: {priceTierLabel(selected.priceTier)}{" "}
            {selected.creditLimit != null && selected.creditLimit > 0
              ? ` · Credit limit $${selected.creditLimit.toLocaleString()}`
              : null}
            {selected.outstandingBalance > 0
              ? ` · Open balance $${selected.outstandingBalance.toLocaleString()}`
              : null}
          </p>
          {selected.outstandingBalance > 0 && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              This company has an outstanding balance. Confirm terms before quoting.
            </p>
          )}

          {selected.contacts.length > 0 ? (
            <label className="mt-3 block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Contact for this quote
              </span>
              <select
                value={contactId || primaryOrFirstContact(selected.contacts)?.id || ""}
                onChange={(e) => setContactId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                {selected.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.email?.trim() ? ` (${c.email})` : " (no email)"}
                    {c.isPrimary ? " · primary" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-zinc-700">No contacts yet for this company.</p>
              {!quickContactOpen ? (
                <button
                  type="button"
                  onClick={() => setQuickContactOpen(true)}
                  className="mt-2 text-sm font-medium text-zinc-800 underline"
                >
                  Add a contact
                </button>
              ) : (
                <form onSubmit={(e) => void handleQuickContact(e)} className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    required
                    placeholder="First name"
                    value={qcFirst}
                    onChange={(e) => setQcFirst(e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    required
                    placeholder="Last name"
                    value={qcLast}
                    onChange={(e) => setQcLast(e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={qcEmail}
                    onChange={(e) => setQcEmail(e.target.value)}
                    className="sm:col-span-2 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    placeholder="Phone"
                    value={qcPhone}
                    onChange={(e) => setQcPhone(e.target.value)}
                    className="sm:col-span-2 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={qcSaving}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {qcSaving ? "Saving…" : "Save contact"}
                    </button>
                    <button type="button" onClick={() => setQuickContactOpen(false)} className="text-sm underline">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!selected || !selectedContact}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        Continue to job type
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">New company</h3>
            <p className="mt-1 text-sm text-zinc-600">Creates the company; you can add a primary contact below.</p>
            <form onSubmit={(e) => void handleModalCreate(e)} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium uppercase text-zinc-500">Name</span>
                <input
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-zinc-500">Type</span>
                <select
                  value={modalType}
                  onChange={(e) => setModalType(e.target.value as CompanyType)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="PROSPECT">Prospect</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="VENDOR">Vendor</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-zinc-500">Address (quote / print)</span>
                <textarea
                  value={modalAddress}
                  onChange={(e) => setModalAddress(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase text-zinc-500">Credit limit ($)</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={modalCredit}
                    onChange={(e) => setModalCredit(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase text-zinc-500">Outstanding balance ($)</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={modalBalance}
                    onChange={(e) => setModalBalance(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
              </div>
              <p className="text-xs font-medium uppercase text-zinc-500">Primary contact (optional)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  placeholder="First name"
                  value={modalCf}
                  onChange={(e) => setModalCf(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Last name"
                  value={modalCl}
                  onChange={(e) => setModalCl(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Phone"
                  value={modalPhone}
                  onChange={(e) => setModalPhone(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {modalSaving ? "Saving…" : "Create company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
