"use client";

import { buttonVariants } from "@/components/print-scheduler/ui/button";
import { Button } from "@/components/print-scheduler/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/print-scheduler/ui/dialog";
import type { JobWithMachine } from "@/lib/print-scheduler/calendar-mapper";
import { normalizeCalendarStatus } from "@/lib/print-scheduler/calendar-mapper";
import {
  formatActivePressDuration,
  formatDateTime,
  formatUsDate,
} from "@/lib/print-scheduler/dates";
import { schedApi } from "@/lib/print-scheduler/paths";
import { readOkJsonWithAuth } from "@/lib/print-scheduler/response-json";
import { cn } from "@/lib/print-scheduler/utils";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

type ToastPayload = { type: "ok" | "err"; text: string };

type JobDetailDialogProps = {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: JobWithMachine[];
  onJobUpdated?: () => void;
  onToast?: (t: ToastPayload) => void;
  canEditSchedule?: boolean;
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{String(value)}</dd>
    </div>
  );
}

export function JobDetailDialog({
  jobId,
  open,
  onOpenChange,
  jobs,
  onJobUpdated,
  onToast,
  canEditSchedule = true,
}: JobDetailDialogProps) {
  const [job, setJob] = useState<JobWithMachine | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveTick, setLiveTick] = useState(0);

  useEffect(() => {
    if (!open || !job) return;
    const s = normalizeCalendarStatus(job.calendarStatus);
    if (s !== "running" && s !== "paused") return;
    const id = window.setInterval(() => setLiveTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [open, job]);

  useEffect(() => {
    if (!open || !jobId) {
      setJob(null);
      return;
    }
    const local = jobs.find((j) => j.id === jobId);
    if (local) {
      setJob(local);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(schedApi(`jobs/${jobId}`));
        const data = await readOkJsonWithAuth<JobWithMachine>(res);
        if (!cancelled) setJob(data);
      } catch {
        if (!cancelled) setJob(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, jobId, jobs]);

  async function patchAction(
    action:
      | "startRun"
      | "finishRun"
      | "cancelJob"
      | "unscheduleJob"
      | "pauseRun"
      | "resumeRun",
  ) {
    if (!job?.id) return;
    setBusy(true);
    try {
      const res = await fetch(schedApi(`jobs/${job.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await readOkJsonWithAuth<JobWithMachine>(res);
      setJob(data);
      onJobUpdated?.();
      const okText: Record<string, string> = {
        startRun: "Press run started.",
        finishRun: "Press run finished — job moved to Completed.",
        cancelJob: "Job cancelled.",
        unscheduleJob: "Removed from schedule.",
        pauseRun: "Press run paused.",
        resumeRun: "Press run resumed.",
      };
      onToast?.({ type: "ok", text: okText[action] ?? "Updated." });
      if (action === "cancelJob" || action === "unscheduleJob") {
        onOpenChange(false);
      }
    } catch (e) {
      onToast?.({
        type: "err",
        text: e instanceof Error ? e.message : "Could not update job",
      });
    } finally {
      setBusy(false);
    }
  }

  const ticketUrl = job?.id ? schedApi(`jobs/${job.id}/ticket`) : null;
  const status = normalizeCalendarStatus(job?.calendarStatus);
  const canStart =
    job &&
    job.machine &&
    status !== "running" &&
    status !== "paused" &&
    status !== "cancelled" &&
    status !== "completed";
  const canPause = job && status === "running" && job.pressRunStartedAt && !job.pressRunEndedAt;
  const canResume = job && status === "paused";
  const canFinish =
    job &&
    (status === "running" || status === "paused") &&
    job.pressRunStartedAt &&
    !job.pressRunEndedAt;
  const canCancel = job && status !== "cancelled" && status !== "completed";
  const canUnschedule =
    job &&
    status !== "cancelled" &&
    status !== "completed" &&
    status !== "running" &&
    status !== "paused" &&
    !(job.pressRunStartedAt && !job.pressRunEndedAt);

  void liveTick;
  const activePrintDuration = job
    ? formatActivePressDuration({
        pressRunStartedAt: job.pressRunStartedAt,
        pressRunEndedAt: job.pressRunEndedAt,
        pressRunPausedAt: job.pressRunPausedAt,
        pressRunTotalPausedMs: job.pressRunTotalPausedMs,
      })
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-zinc-100 px-6 pb-4 pt-6 dark:border-zinc-900">
          <DialogTitle>
            Job {job?.jobNumber ?? "…"}
            {job?.title ? (
              <span className="mt-1 block text-base font-normal text-zinc-600 dark:text-zinc-400">
                {job.title}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Full ticket fields and uploaded PDF (when available).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {!job ? (
            <p className="text-sm text-zinc-500">Loading job…</p>
          ) : (
            <>
              {canEditSchedule ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <p className="mb-2 text-xs font-medium text-zinc-500 uppercase">Schedule</p>
                  <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
                    Take a job off the calendar without cancelling it, or cancel it to track it under
                    Cancelled jobs.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy || !canUnschedule}
                      title={
                        !canUnschedule
                          ? "Not available while a press run is active (running or paused)."
                          : undefined
                      }
                      onClick={() => {
                        if (
                          !confirm(
                            "Remove this job from the schedule? It will stay in the system as unscheduled (not cancelled).",
                          )
                        )
                          return;
                        void patchAction("unscheduleJob");
                      }}
                    >
                      Remove from schedule
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy || !canCancel}
                      onClick={() => {
                        if (
                          !confirm(
                            "Cancel this job? It will be removed from the schedule, moved to Cancelled jobs, and any press timer cleared.",
                          )
                        )
                          return;
                        void patchAction("cancelJob");
                      }}
                    >
                      Cancel job
                    </Button>
                  </div>
                </div>
             ) : null}

              <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="mb-2 text-xs font-medium text-zinc-500 uppercase">Press run</p>
                <div className="grid gap-1.5 text-sm">
                  <Row label="Started" value={formatDateTime(job.pressRunStartedAt)} />
                  <Row
                    label="Ended"
                    value={
                      job.pressRunEndedAt
                        ? formatDateTime(job.pressRunEndedAt)
                        : status === "paused"
                          ? "Paused"
                          : status === "running"
                            ? "In progress"
                            : "—"
                    }
                  />
                  <Row
                    label="Active print time"
                    value={
                      job.pressRunStartedAt ? activePrintDuration : "—"
                    }
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Active print time excludes pauses (wall clock minus paused time).
                </p>
                {canEditSchedule ? (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || !canStart}
                        onClick={() => void patchAction("startRun")}
                      >
                        Start press run
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy || !canPause}
                        onClick={() => void patchAction("pauseRun")}
                      >
                        Pause
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy || !canResume}
                        title="Continue the press run; paused time is not counted toward print time."
                        onClick={() => void patchAction("resumeRun")}
                      >
                        Start where you left off
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy || !canFinish}
                        onClick={() => void patchAction("finishRun")}
                      >
                        Finish press run
                      </Button>
                    </div>
                    {!job.machine ? (
                      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
                        Assign a machine on the calendar before starting a press run.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Row label="PO" value={job.poNumber} />
                <Row label="Customer" value={job.customerName} />
                {job.dueDate ? <Row label="Due" value={formatUsDate(job.dueDate)} /> : null}
                {job.proofDue ? <Row label="Proof due" value={formatUsDate(job.proofDue)} /> : null}
                {job.needInHandsAt ? (
                  <div className="grid grid-cols-[8rem_1fr] gap-x-3 text-sm">
                    <dt className="text-zinc-500">Need in hands</dt>
                    <dd className="text-zinc-900 dark:text-zinc-100">
                      {formatUsDate(job.needInHandsAt)}
                      <span className="ml-1 text-xs text-zinc-500">(reference only)</span>
                    </dd>
                  </div>
                ) : null}
                <Row label="Machine" value={job.machine?.name} />
                <Row label="Press" value={job.pressModel} />
                <Row label="Stock" value={job.stockDescription} />
                <Row label="Run sheet size" value={job.runSheetSize} />
                <Row label="Sheets to press" value={job.sheetsToPress ?? undefined} />
                <Row label="Duplex" value={job.duplex === true ? "Yes" : job.duplex === false ? "No" : "—"} />
                <Row label="Paper GSM (override)" value={job.paperGsm ?? undefined} />
                <Row label="Qty" value={job.quantity ?? undefined} />
                <Row
                  label="Est. / CSR"
                  value={[job.estimateNumber, job.csr].filter(Boolean).join(" · ") || undefined}
                />
                <Row label="Salesperson" value={job.salesperson} />
                <Row label="Priority" value={job.priority} />
                <Row label="Status" value={job.calendarStatus} />
              </div>

              {job.description ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500 uppercase">Description</p>
                  <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                    {job.description}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500 uppercase">Job ticket</p>
                {job.ticketPdfPath && ticketUrl ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                      >
                        <ExternalLink className="size-3.5" />
                        Open PDF in new tab
                      </a>
                      <span className="text-xs text-zinc-500">{job.sourceFileName ?? "ticket.pdf"}</span>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <iframe
                        title="Job ticket PDF"
                        src={ticketUrl}
                        className="h-[min(50vh,420px)] w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No PDF file stored for this job (imports before ticket storage was added, or save
                    failed). Parsed text is below if available.
                  </p>
                )}
              </div>

              {job.rawPdfText ? (
                <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/30">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Extracted ticket text
                  </summary>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-zinc-200 px-3 py-2 text-[11px] leading-snug text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                    {job.rawPdfText}
                  </pre>
                </details>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
