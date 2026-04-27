"use client";

import { Building2, FileText, Search, UserRound, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";

type SearchResponse = {
  accounts: { id: string; name: string; type: string }[];
  contacts: { id: string; name: string; email: string | null; companyId: string; companyName: string }[];
  estimates: { id: string; label: string; subtitle: string }[];
  jobs: { id: string; label: string; subtitle: string; machineName: string }[];
};

const empty: SearchResponse = {
  accounts: [],
  contacts: [],
  estimates: [],
  jobs: [],
};

export function CrmCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse>(empty);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback((query: string) => {
    const t = query.trim();
    if (t.length === 0) {
      setData(empty);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetch(`/api/crm/search?q=${encodeURIComponent(t)}`)
      .then((r) => r.json() as Promise<SearchResponse>)
      .then(setData)
      .catch(() => setData(empty))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setData(empty);
      return;
    }
    const id = setTimeout(() => runSearch(q), 180);
    return () => clearTimeout(id);
  }, [open, q, runSearch]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const hasAny =
    data.accounts.length +
      data.contacts.length +
      data.estimates.length +
      data.jobs.length >
    0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false} label="CRM search">
      <div className="border-b border-zinc-200 px-3 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2">
          <Search className="size-4 shrink-0 text-zinc-500" strokeWidth={2} />
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Search… (e.g. machine name, company, estimate #, contact)"
            className="flex h-11 w-full border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
        <p className="pb-2 pt-1 text-center text-[10px] text-zinc-400">⌘K · Ctrl K</p>
      </div>
      <CommandList className="max-h-[min(60vh,22rem)] overflow-y-auto p-2">
        <CommandEmpty className="py-8 text-center text-sm text-zinc-500">
          {loading ? "Searching…" : q.trim() ? "No matches." : "Type to search across CRM objects."}
        </CommandEmpty>
        {hasAny ? (
          <>
            {data.accounts.length > 0 ? (
              <CommandGroup heading="Accounts" className="px-1 py-1 text-xs font-medium text-zinc-500">
                {data.accounts.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`account-${a.id}`}
                    onSelect={() => go(`/crm/accounts/${a.id}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-zinc-100"
                  >
                    <Building2 className="size-4 text-zinc-500" strokeWidth={2} />
                    <span className="font-medium text-zinc-900">{a.name}</span>
                    <span className="text-xs text-zinc-500">{a.type.toLowerCase()}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data.contacts.length > 0 ? (
              <CommandGroup heading="Contacts" className="px-1 py-1 text-xs font-medium text-zinc-500">
                {data.contacts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`contact-${c.id}`}
                    onSelect={() => go(`/crm/accounts/${c.companyId}`)}
                    className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-zinc-100"
                  >
                    <span className="flex items-center gap-2">
                      <UserRound className="size-4 shrink-0 text-zinc-500" strokeWidth={2} />
                      <span className="font-medium text-zinc-900">{c.name}</span>
                    </span>
                    <span className="pl-6 text-xs text-zinc-600">
                      {c.email?.trim() || "No email"} · {c.companyName}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data.estimates.length > 0 ? (
              <CommandGroup heading="Deals (estimates)" className="px-1 py-1 text-xs font-medium text-zinc-500">
                {data.estimates.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`est-${e.id}`}
                    onSelect={() => go(`/estimates/${e.id}`)}
                    className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-zinc-100"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-zinc-500" strokeWidth={2} />
                      <span className="font-medium text-zinc-900">{e.label}</span>
                    </span>
                    <span className="pl-6 text-xs text-zinc-600">{e.subtitle}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data.jobs.length > 0 ? (
              <CommandGroup heading="Jobs" className="px-1 py-1 text-xs font-medium text-zinc-500">
                {data.jobs.map((j) => (
                  <CommandItem
                    key={j.id}
                    value={`job-${j.id}`}
                    onSelect={() => go(`/jobs/${j.id}`)}
                    className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-zinc-100"
                  >
                    <span className="flex items-center gap-2">
                      <Wrench className="size-4 shrink-0 text-zinc-500" strokeWidth={2} />
                      <span className="font-medium text-zinc-900">{j.label}</span>
                    </span>
                    <span className="pl-6 text-xs text-zinc-600">{j.subtitle}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
