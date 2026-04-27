import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { CrmNewAccountForm } from "@/components/crm/crm-new-account-form";
import { CrmNewContactForm } from "@/components/crm/crm-new-contact-form";

export default function CrmHubPage() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-10">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
          ← Home
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--dashboard-accent)]/15 text-[var(--dashboard-accent)]">
            <Building2 className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">CRM</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-600">
              Account-based customer records: organizations, contacts, and deals (estimates & jobs) linked
              together. Press{" "}
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                ⌘K
              </kbd>{" "}
              or{" "}
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                Ctrl K
              </kbd>{" "}
              to search accounts, contacts, quotes, and jobs from anywhere.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Search className="size-3.5" strokeWidth={2} />
              Command palette searches machines by name (e.g. lamination lines), companies, and estimate
              numbers.
            </p>
          </div>
        </div>
      </header>

      <div className="mb-10 flex flex-wrap gap-3">
        <Link
          href="/crm/accounts"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
        >
          All accounts
        </Link>
        <Link
          href="/estimate/new"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
        >
          New estimate (deal)
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <CrmNewAccountForm />
        <CrmNewContactForm />
      </div>
    </div>
  );
}
