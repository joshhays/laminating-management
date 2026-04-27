import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { workflowLabel } from "@/lib/workflow/job-workflow";

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

export default async function JobsIndexPage() {
  const jobs = await prisma.jobTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      estimate: {
        select: {
          id: true,
          estimateNumber: true,
          filmType: true,
          sheetSize: true,
        },
      },
      machine: true,
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Laminating job tickets created from estimates. Open a row for shop floor, film
            pull, and printable ticket.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/jobs/reporting"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Reporting
          </Link>
          <Link
            href="/estimates"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            All estimates
          </Link>
        </div>
      </header>

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No jobs yet. Convert an estimate when you are ready to run it.{" "}
          <Link href="/estimates" className="font-medium text-zinc-800 underline">
            View estimates
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Line status</th>
                <th className="px-4 py-3">Quote</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Machine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {jobs.map((j) => {
                const desc =
                  j.ticketTitle?.trim() ||
                  (j.estimate
                    ? `${j.estimate.sheetSize} · ${j.estimate.filmType}`.trim()
                    : null);
                const quoteLabel =
                  j.estimate?.estimateNumber != null
                    ? `#${j.estimate.estimateNumber}`
                    : null;
                return (
                  <tr key={j.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3">
                      <Link
                        href={`/jobs/${j.id}`}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                      >
                        {j.jobNumber != null ? (
                          <span className="tabular-nums">Job #{j.jobNumber}</span>
                        ) : (
                          <span className="font-mono text-xs">{j.id.slice(0, 10)}…</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-800">{workflowLabel(j.workflowStatus)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-600">{jobStatusLabel(j.status)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {j.estimate && quoteLabel ? (
                        <Link
                          href={`/estimates/${j.estimate.id}`}
                          className="tabular-nums text-[var(--dashboard-accent)] hover:underline"
                        >
                          {quoteLabel}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td
                      className="max-w-[240px] truncate px-4 py-3 text-zinc-700"
                      title={desc ?? undefined}
                    >
                      {desc ?? "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-zinc-600" title={j.machineAssigned}>
                      {j.machine?.name?.trim() || j.machineAssigned || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
