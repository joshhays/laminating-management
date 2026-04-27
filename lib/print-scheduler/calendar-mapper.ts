import type { PrintPressMachine as Machine, PrintScheduleJob as PrintJob } from "@prisma/client";
import type { CalendarEventBlock } from "@/types/calendar";

export type JobWithMachine = PrintJob & { machine: Machine | null };

/** Normalize for comparisons (handles legacy casing / whitespace in `calendarStatus`). */
export function normalizeCalendarStatus(value: string | null | undefined): string {
  const s = (value ?? "").trim().toLowerCase();
  return s || "scheduled";
}

function coerceDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function toIso(d: Date | string): string {
  const x = coerceDate(d);
  return Number.isNaN(x.getTime()) ? new Date().toISOString() : x.toISOString();
}

export function printJobToCalendarBlock(job: JobWithMachine): CalendarEventBlock | null {
  const st = normalizeCalendarStatus(job.calendarStatus);
  if (st === "cancelled" || st === "completed") return null;
  if (!job.machine) return null;

  let start: string;
  let end: string;
  let color = job.color ?? "#3b82f6";

  const onPress =
    (st === "running" || st === "paused") && job.pressRunStartedAt && !job.pressRunEndedAt;

  if (onPress) {
    start = toIso(job.pressRunStartedAt!);
    const plannedEnd = job.endTime ? coerceDate(job.endTime).getTime() : 0;
    const tail = Math.max(Date.now() + 10 * 60_000, plannedEnd, Date.now() + 15 * 60_000);
    end = new Date(tail).toISOString();
    color = st === "paused" ? "#ca8a04" : "#d97706";
  } else {
    if (!job.startTime || !job.endTime) return null;
    start = toIso(job.startTime);
    end = toIso(job.endTime);
  }

  const subtitle =
    job.title?.trim() || job.customerName?.trim() || "Scheduled run";
  const pressLabel =
    st === "paused" ? " · PAUSED" : st === "running" ? " · ON PRESS" : "";

  return {
    id: job.id,
    resourceId: job.machine.slug,
    title: `#${job.jobNumber} · ${subtitle}${pressLabel}`.slice(0, 120),
    start,
    end,
    color,
    extendedProps: {
      status: st,
      pdfSource: job.sourceFileName ?? null,
      jobNumber: job.jobNumber,
    },
  };
}

export function jobsToCalendarEvents(jobs: JobWithMachine[]): CalendarEventBlock[] {
  return jobs.map(printJobToCalendarBlock).filter((e): e is CalendarEventBlock => e !== null);
}
