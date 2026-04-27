"use client";

import type { JobWithMachine } from "@/lib/print-scheduler/calendar-mapper";
import { normalizeCalendarStatus } from "@/lib/print-scheduler/calendar-mapper";
import { formatActivePressDuration, formatDateTime, formatUsDate } from "@/lib/print-scheduler/dates";
import { cn } from "@/lib/print-scheduler/utils";

type JobStatusListsProps = {
  jobs: JobWithMachine[];
  onSelectJob: (id: string) => void;
  variant: "completed" | "cancelled";
};

function sortCompleted(a: JobWithMachine, b: JobWithMachine) {
  const ae = a.pressRunEndedAt ? new Date(a.pressRunEndedAt).getTime() : 0;
  const be = b.pressRunEndedAt ? new Date(b.pressRunEndedAt).getTime() : 0;
  return be - ae;
}

function sortCancelled(a: JobWithMachine, b: JobWithMachine) {
  const au = new Date(a.updatedAt).getTime();
  const bu = new Date(b.updatedAt).getTime();
  return bu - au;
}

export function JobStatusLists({ jobs, onSelectJob, variant }: JobStatusListsProps) {
  const filtered =
    variant === "completed"
      ? jobs.filter((j) => normalizeCalendarStatus(j.calendarStatus) === "completed")
      : jobs.filter((j) => normalizeCalendarStatus(j.calendarStatus) === "cancelled");

  const sorted = [...filtered].sort(variant === "completed" ? sortCompleted : sortCancelled);

  if (sorted.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        {variant === "completed"
          ? "No completed press runs yet. Finish a run from the calendar job detail."
          : "No cancelled jobs."}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/90 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <th className="px-4 py-3">Job</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3 hidden sm:table-cell">Due</th>
            {variant === "completed" ? (
              <>
                <th className="px-4 py-3 hidden md:table-cell">Finished</th>
                <th className="px-4 py-3">Print time</th>
              </>
            ) : (
              <th className="px-4 py-3 hidden md:table-cell">Updated</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {sorted.map((job) => (
            <tr
              key={job.id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
              )}
              onClick={() => onSelectJob(job.id)}
            >
              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                #{job.jobNumber}
                {job.title ? (
                  <span className="mt-0.5 block max-w-[200px] truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {job.title}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                {job.customerName ?? "—"}
              </td>
              <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell dark:text-zinc-400">
                {formatUsDate(job.dueDate)}
              </td>
              {variant === "completed" ? (
                <>
                  <td className="px-4 py-3 text-zinc-600 hidden md:table-cell dark:text-zinc-400">
                    {formatDateTime(job.pressRunEndedAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 tabular-nums dark:text-zinc-300">
                    {formatActivePressDuration({
                      pressRunStartedAt: job.pressRunStartedAt,
                      pressRunEndedAt: job.pressRunEndedAt,
                      pressRunPausedAt: job.pressRunPausedAt,
                      pressRunTotalPausedMs: job.pressRunTotalPausedMs,
                    })}
                  </td>
                </>
              ) : (
                <td className="px-4 py-3 text-zinc-600 hidden md:table-cell dark:text-zinc-400">
                  {formatDateTime(job.updatedAt)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Click a row for full details and ticket PDF.
      </p>
    </div>
  );
}
