"use client";

import { Button } from "@/components/print-scheduler/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/print-scheduler/ui/sheet";
import { formatUsDate } from "@/lib/print-scheduler/dates";
import { estimatePlacementMinutes } from "@/lib/print-scheduler/estimate-run";
import { schedApi } from "@/lib/print-scheduler/paths";
import { readOkJsonWithAuth, readResponseJson } from "@/lib/print-scheduler/response-json";
import type { PrintScheduleJob as PrintJob } from "@prisma/client";
import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type MachineRow = {
  id: string;
  slug: string;
  name: string;
  pressType?: string | null;
  speedSheetsPerHour?: number | null;
  speedPagesPerMinute?: number | null;
  speedMatrixJson?: string | null;
};

type Stage = "idle" | "parsing" | "preview";

function defaultRunStart(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(9);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Default press slot: 9:00 local, one calendar day before job due (not need-in-hands). */
function runStartOneDayBeforeDue(due: Date | string | null | undefined): Date {
  if (due == null || due === "") return defaultRunStart();
  const dueD = due instanceof Date ? new Date(due.getTime()) : new Date(due);
  if (Number.isNaN(dueD.getTime())) return defaultRunStart();
  const y = dueD.getFullYear();
  const m = dueD.getMonth();
  const day = dueD.getDate();
  const run = new Date(y, m, day - 1, 9, 0, 0, 0);
  if (run.getTime() <= Date.now()) {
    return defaultRunStart();
  }
  return run;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type JobIntakeDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machines: MachineRow[];
  onPlaced: (jobId: string) => void;
  onToast: (msg: { type: "ok" | "err"; text: string }) => void;
};

export function JobIntakeDrawer({
  open,
  onOpenChange,
  machines,
  onPlaced,
  onToast,
}: JobIntakeDrawerProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [draftJob, setDraftJob] = useState<PrintJob | null>(null);
  const [title, setTitle] = useState("");
  const [runStart, setRunStart] = useState(toDatetimeLocal(defaultRunStart()));
  const [estMinutes, setEstMinutes] = useState(150);
  const [resourceSlug, setResourceSlug] = useState("printer_01");
  const [duplex, setDuplex] = useState(false);
  const [paperGsmOverride, setPaperGsmOverride] = useState("");

  const reset = useCallback(() => {
    setStage("idle");
    setDraftJob(null);
    setTitle("");
    setRunStart(toDatetimeLocal(defaultRunStart()));
    setEstMinutes(150);
    setResourceSlug(machines[0]?.slug ?? "printer_01");
    setDuplex(false);
    setPaperGsmOverride("");
    setDragOver(false);
  }, [machines]);

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(reset, 200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, reset]);

  useEffect(() => {
    if (!open || !machines.length) return;
    setResourceSlug((s) => (machines.some((m) => m.slug === s) ? s : machines[0]!.slug));
  }, [open, machines]);

  useEffect(() => {
    if (stage !== "preview" || !draftJob) return;
    const m = machines.find((x) => x.slug === resourceSlug);
    const gsmRaw = paperGsmOverride.trim();
    const gsmParsed =
      gsmRaw === "" ? null : Math.round(Number(gsmRaw));
    const paperGsm =
      gsmParsed != null && Number.isFinite(gsmParsed) && gsmParsed > 0 ? gsmParsed : null;
    const est = estimatePlacementMinutes(m, {
      sheetsToPress: draftJob.sheetsToPress,
      runSheetSize: draftJob.runSheetSize,
      stockDescription: draftJob.stockDescription,
      duplex,
      paperGsm,
    });
    if (est != null) setEstMinutes(est);
  }, [
    stage,
    draftJob?.id,
    draftJob?.sheetsToPress,
    draftJob?.runSheetSize,
    draftJob?.stockDescription,
    resourceSlug,
    machines,
    duplex,
    paperGsmOverride,
  ]);

  async function parsePdf(file: File) {
    setStage("parsing");
    setDraftJob(null);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const res = await fetch(schedApi("jobs/import"), { method: "POST", body: fd });
      const data = await readResponseJson<{ job?: PrintJob; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      const job = data.job;
      if (!job) throw new Error("Import response missing job");
      setDraftJob(job);
      setTitle((job.title as string) || `Job ${job.jobNumber}`);
      setDuplex(job.duplex === true);
      setPaperGsmOverride("");
      setRunStart(toDatetimeLocal(runStartOneDayBeforeDue(job.dueDate)));
      setStage("preview");
      onToast({
        type: "ok",
        text: `Parsed job ${job.jobNumber}. Confirm to place on the board.`,
      });
    } catch (e) {
      setStage("idle");
      onToast({
        type: "err",
        text: e instanceof Error ? e.message : "Import failed",
      });
    }
  }

  function onDropFile(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type === "application/pdf" || f?.name?.toLowerCase().endsWith(".pdf")) {
      void parsePdf(f);
    } else {
      onToast({ type: "err", text: "Please drop a PDF ticket." });
    }
  }

  async function confirmPlace() {
    if (!draftJob) return;
    const start = new Date(runStart);
    if (Number.isNaN(start.getTime())) {
      onToast({ type: "err", text: "Invalid start time." });
      return;
    }
    const end = new Date(start.getTime() + Math.max(15, estMinutes) * 60_000);
    try {
      const res = await fetch(schedApi(`jobs/${draftJob.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          resourceId: resourceSlug,
          calendarStatus: "scheduled",
          duplex,
          paperGsm:
            paperGsmOverride.trim() === ""
              ? null
              : (() => {
                  const n = Math.round(Number(paperGsmOverride));
                  return Number.isFinite(n) && n > 0 ? n : null;
                })(),
        }),
      });
      const data = await readOkJsonWithAuth<{ id: string }>(res);
      onOpenChange(false);
      onPlaced(String(data.id));
      onToast({ type: "ok", text: "Job added to the schedule board." });
    } catch (e) {
      onToast({
        type: "err",
        text: e instanceof Error ? e.message : "Schedule update failed",
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="px-6 text-left">
          <SheetTitle>New job</SheetTitle>
          <SheetDescription>
            Import a ticket PDF. Default run start is one day before the job due date at 9:00 (need
            in hands is not used for scheduling). Adjust and confirm to place the job on the
            calendar.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8 pt-2">
          {stage === "idle" && (
            <div
              role="button"
              tabIndex={0}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropFile}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  document.getElementById("intake-pdf-input")?.click();
                }
              }}
              className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 transition-colors ${
                dragOver
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900/50"
                  : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30"
              }`}
              onClick={() => document.getElementById("intake-pdf-input")?.click()}
            >
              <FileUp className="size-8 text-zinc-400" />
              <p className="text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Drop PDF here or click to browse
              </p>
              <p className="text-center text-xs text-zinc-500">Pace-style text PDFs work best</p>
              <input
                id="intake-pdf-input"
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void parsePdf(f);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {stage === "parsing" && (
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Loader2 className="size-4 animate-spin" />
                Parsing ticket…
              </div>
              <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-900 dark:bg-zinc-900/40">
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-1/2 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-5/6 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          )}

          {stage === "preview" && draftJob && (
            <div className="flex flex-col gap-5 pt-2">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-900 dark:bg-zinc-900/50 dark:text-zinc-400">
                Job #{draftJob.jobNumber}
                {draftJob.dueDate ? (
                  <span className="ml-2">· Due {formatUsDate(draftJob.dueDate)}</span>
                ) : null}
                {draftJob.stockDescription || draftJob.runSheetSize ? (
                  <div className="mt-2 space-y-0.5 border-t border-zinc-200/80 pt-2 text-[11px] leading-snug dark:border-zinc-700/80">
                    {draftJob.stockDescription ? (
                      <p>
                        <span className="font-semibold text-zinc-500 dark:text-zinc-400">Stock · </span>
                        {draftJob.stockDescription}
                      </p>
                    ) : null}
                    {draftJob.runSheetSize ? (
                      <p>
                        <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                          Run sheet size ·{" "}
                        </span>
                        {draftJob.runSheetSize}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Job name
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Run start
                </label>
                <input
                  type="datetime-local"
                  value={runStart}
                  onChange={(e) => setRunStart(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={duplex}
                    onChange={(e) => setDuplex(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  Duplex (2-sided)
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Paper GSM (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="From stock line if blank"
                  value={paperGsmOverride}
                  onChange={(e) => setPaperGsmOverride(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Est. run time (minutes)
                </label>
                <input
                  type="number"
                  min={15}
                  step={5}
                  value={estMinutes}
                  onChange={(e) => setEstMinutes(Number(e.target.value) || 150)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <p className="text-[11px] leading-snug text-zinc-500">
                  Suggested from sheets to press, press settings, run sheet size (small vs large),
                  GSM (from stock or override), and duplex. Digital presses with an IPM matrix use
                  impressions ÷ IPM; others use sheets/hr or toner ppm × 60.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Machine
                </label>
                <select
                  value={resourceSlug}
                  onChange={(e) => setResourceSlug(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.slug}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  type="button"
                  onClick={() => {
                    setStage("idle");
                    setDraftJob(null);
                  }}
                >
                  Back
                </Button>
                <Button className="flex-1" type="button" onClick={() => void confirmPlace()}>
                  Confirm & place
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
