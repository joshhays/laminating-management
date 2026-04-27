import { JobStatus, type Estimate, type JobTicket, type Machine } from "@prisma/client";
import type { CalendarEventBlock } from "@/types/calendar";

function coerceDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export type LaminatingJobCalendarRow = JobTicket & {
  estimate: (Estimate & { filmRoll?: unknown; secondFilmRoll?: unknown }) | null;
  machine: Machine | null;
};

/** Serialized API row (`Date` fields as ISO strings). */
export type LaminatingJobCalendarApiRow = Omit<
  JobTicket,
  | "scheduledStart"
  | "scheduledEnd"
  | "createdAt"
  | "updatedAt"
  | "shippedAt"
> & {
  scheduledStart: string | Date | null;
  scheduledEnd: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  shippedAt: string | Date | null;
  estimate: LaminatingJobCalendarRow["estimate"];
  machine: Machine | null;
};

export function laminatingJobToCalendarBlock(
  job: LaminatingJobCalendarRow | LaminatingJobCalendarApiRow,
): CalendarEventBlock | null {
  if (!job.scheduledStart || !job.scheduledEnd) return null;
  if (job.status === JobStatus.DONE || job.status === JobStatus.SHIPPED) return null;

  const resourceId = job.machineId ?? "__unassigned__";
  const est = job.estimate;

  const jobNum = job.jobNumber != null && Number.isFinite(job.jobNumber) ? job.jobNumber : null;
  const quoteLabel = est?.estimateNumber != null ? `Q${est.estimateNumber}` : "Quote";
  const numLabel = jobNum != null ? `J${jobNum}` : quoteLabel;
  const film = est?.filmType?.trim() || "—";
  const qty = est?.quantity != null ? `${est.quantity} qty` : "";
  const title = `${numLabel} · ${film}${qty ? ` · ${qty}` : ""}`.slice(0, 120);

  const runMin =
    est?.estimatedRunTimeMinutes != null && est.estimatedRunTimeMinutes > 0
      ? Math.round(est.estimatedRunTimeMinutes)
      : null;
  const sheet = est?.sheetSize?.trim() || "";
  const paper = est?.paperDescription?.trim();
  const subtitle = [
    sheet,
    paper || null,
    runMin != null ? `~${runMin} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let color = "#0ea5e9";
  if (job.status === "IN_PROGRESS") color = "#d97706";

  const startD = coerceDate(job.scheduledStart);
  const endD = coerceDate(job.scheduledEnd);
  if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) return null;

  return {
    id: job.id,
    resourceId,
    title,
    start: startD.toISOString(),
    end: endD.toISOString(),
    color,
    extendedProps: {
      status: "scheduled",
      pdfSource: null,
      jobNumber: jobNum != null ? String(jobNum) : undefined,
      estimateNumber: est?.estimateNumber ?? null,
      subtitle: subtitle || null,
    },
  };
}

export function laminatingJobsToCalendarEvents(
  jobs: (LaminatingJobCalendarRow | LaminatingJobCalendarApiRow)[],
): CalendarEventBlock[] {
  return jobs.map(laminatingJobToCalendarBlock).filter((e): e is CalendarEventBlock => e !== null);
}
