import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function typeLabel(t: string) {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export default async function CrmAccountsPage() {
  const rows = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { estimates: true } },
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link href="/crm" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
          ← CRM
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
            <Building2 className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Accounts</h1>
            <p className="mt-1 text-sm text-zinc-600">Organizations linked to estimates and jobs.</p>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
          No accounts yet. Add one from{" "}
          <Link href="/crm" className="font-medium underline hover:no-underline">
            CRM home
          </Link>{" "}
          or{" "}
          <Link href="/estimate/new" className="font-medium underline hover:no-underline">
            New estimate
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Deals (estimates)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/crm/accounts/${c.id}`}
                      className="font-medium text-zinc-900 underline hover:no-underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{typeLabel(c.type)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-800">
                    {c._count.estimates}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
