import Link from "next/link";
import { JobWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workflowLabel } from "@/lib/workflow/job-workflow";

export const dynamic = "force-dynamic";

export default async function JobsReportingPage() {
  const jobs = await prisma.jobTicket.findMany({
    where: { workflowStatus: JobWorkflowStatus.COMPLETE },
    orderBy: [{ workflowLockedAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      estimate: {
        select: { estimateNumber: true, filmType: true },
      },
      machine: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link href="/jobs" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
          ← All jobs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Reporting</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Finished jobs (workflow complete) are locked for editing. Open a row for a read-only job
          record.
        </p>
      </header>

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">No completed jobs yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Line</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {jobs.map((j) => (
                <tr key={j.id} className="bg-white">
                  <td className="px-4 py-3">
                    <Link
                      href={`/jobs/${j.id}`}
                      className="font-medium text-[var(--dashboard-accent)] hover:underline"
                    >
                      {j.jobNumber != null ? `Job #${j.jobNumber}` : j.id.slice(0, 8) + "…"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{workflowLabel(j.workflowStatus)}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600">
                    {j.workflowLockedAt != null
                      ? new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(j.workflowLockedAt)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {j.customerCompanyName?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{j.machine?.name ?? j.machineAssigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
