"use client";

import { JobWorkflowStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  WORKFLOW_ORDER,
  workflowLabel,
  workflowNextActionLabel,
  workflowIndex,
} from "@/lib/workflow/job-workflow";

type Props = {
  jobId: string;
  jobNumber: number | null;
  workflowStatus: JobWorkflowStatus;
  locked: boolean;
};

export function JobWorkflowHeader({ jobId, jobNumber, workflowStatus, locked }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIdx = workflowIndex(workflowStatus);
  const actionLabel = workflowNextActionLabel(workflowStatus);

  async function advance() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/job-tickets/${jobId}/workflow-advance`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not advance");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sticky top-0 z-30 border-b border-zinc-200/90 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-md print:hidden sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Job workflow</p>
            <p className="text-sm font-semibold text-zinc-900">
              {jobNumber != null ? `Job #${jobNumber}` : "Job"}{" "}
              <span className="font-normal text-zinc-600">· {workflowLabel(workflowStatus)}</span>
            </p>
          </div>
          {locked ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              Complete · locked
            </span>
          ) : actionLabel ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void advance()}
              className="rounded-lg bg-[var(--dashboard-accent)] px-4 py-2 text-sm font-medium text-white shadow-md shadow-[#3F3DBC]/20 hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "Working…" : actionLabel}
            </button>
          ) : null}
        </div>

        <div className="relative pt-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
            {WORKFLOW_ORDER.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div
                  key={step}
                  title={workflowLabel(step)}
                  className={cn(
                    "h-full min-w-0 flex-1 border-r border-white/40 last:border-r-0",
                    done && "bg-emerald-500",
                    active && !done && "bg-[var(--dashboard-accent)]",
                    !done && !active && "bg-zinc-200",
                  )}
                />
              );
            })}
          </div>
          <div className="mt-2 hidden gap-1 text-[10px] font-medium text-zinc-500 sm:flex sm:justify-between">
            {WORKFLOW_ORDER.map((step) => (
              <span
                key={step}
                className={cn(
                  "min-w-0 flex-1 truncate text-center",
                  workflowIndex(step) === currentIdx && "text-zinc-900",
                )}
              >
                {workflowLabel(step)}
              </span>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
