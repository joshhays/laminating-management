import Link from "next/link";
import { quoteLetterDisplayNumber } from "@/lib/quote-letter-content";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function jobStatusLabel(s: string) {
  switch (s) {
    case "QUEUED":
      return "Queued";
    case "IN_PROGRESS":
      return "In progress";
    case "DONE":
      return "Done";
    case "SHIPPED":
      return "Shipped";
    default:
      return s;
  }
}

export default async function EstimatesIndexPage() {
  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    include: { jobTicket: true, estimateBundle: true },
    take: 100,
  });

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Estimates</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Open an estimate to convert it to a job ticket when you are ready.
          </p>
        </div>
        <Link
          href="/estimate/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New estimate
        </Link>
      </header>

      {estimates.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No estimates yet.{" "}
          <Link href="/estimate/new" className="font-medium text-zinc-800 underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Estimate</th>
                <th className="px-4 py-3">Film</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Est. lin. ft</th>
                <th className="px-4 py-3">Job</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {estimates.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3">
                    <Link
                      href={`/estimates/${e.id}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                    >
                      <span className="tabular-nums">
                        #{quoteLetterDisplayNumber(e, e.estimateBundle)}
                      </span>
                      {e.bundleId != null && (e.bundlePartLabel?.trim() || e.bundleSortOrder > 0) ? (
                        <span className="ml-1 text-xs font-normal text-zinc-500">
                          ({e.bundlePartLabel?.trim() || `Part ${e.bundleSortOrder + 1}`})
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-700" title={e.filmType}>
                    {e.filmType}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700">{e.quantity}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700">
                    {e.estimatedLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3">
                    {e.jobTicket ? (
                      <Link
                        href={`/jobs/${e.jobTicket.id}`}
                        className="text-xs font-medium text-emerald-800 hover:underline"
                      >
                        {jobStatusLabel(e.jobTicket.status)}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
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
