import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopQuoteBoilerplate } from "@/lib/shop-quote-settings";
import { JobTicketShell } from "./job-ticket-shell";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function statusLabel(s: string) {
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await prisma.jobTicket.findUnique({
    where: { id },
    select: { jobNumber: true },
  });
  if (!job) return { title: "Job ticket" };
  return {
    title:
      job.jobNumber != null ? `Job ticket #${job.jobNumber}` : `Job ticket · ${id.slice(0, 8)}…`,
  };
}

export default async function JobTicketLetterPage({ params }: PageProps) {
  const { id } = await params;

  const job = await prisma.jobTicket.findUnique({
    where: { id },
    include: {
      estimate: { select: { id: true, estimateNumber: true } },
      machine: true,
    },
  });

  if (!job) notFound();

  const shop = getShopQuoteBoilerplate();

  const df = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const dfDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

  const scheduleLabel =
    job.scheduledStart != null && job.scheduledEnd != null
      ? `${df.format(job.scheduledStart)} — ${df.format(job.scheduledEnd)}`
      : null;

  const shippedAtLabel =
    job.shippedAt != null ? df.format(job.shippedAt) : null;

  const quoteLabel =
    job.estimate?.estimateNumber != null
      ? `Quote #${job.estimate.estimateNumber}`
      : null;

  const hasTicketSnapshot = Boolean(
    job.ticketTitle?.trim() ||
      job.stockInformation?.trim() ||
      job.filmInformation?.trim() ||
      job.pressRunInformation?.trim() ||
      job.binderyInstructions?.trim() ||
      job.shippingInstructions?.trim() ||
      job.ticketDescriptionAdditional?.trim() ||
      job.dueDate != null ||
      job.customerCompanyName?.trim(),
  );

  const meta = {
    jobId: job.id,
    jobNumberLabel: job.jobNumber != null ? `Job #${job.jobNumber}` : "Job (no #)",
    statusLabel: statusLabel(job.status),
    quoteLabel,
    estimateId: job.estimate?.id ?? null,
    scheduleLabel,
    machineLine: job.machine?.name?.trim() || job.machineAssigned || "—",
    shippedAtLabel,
    printedAtLabel: dfDate.format(new Date()),
    legacyNoSnapshot: !hasTicketSnapshot,
    shop,
  };

  const initial = {
    dueDate: job.dueDate,
    ticketTitle: job.ticketTitle,
    ticketDescriptionAdditional: job.ticketDescriptionAdditional,
    stockInformation: job.stockInformation,
    filmInformation: job.filmInformation,
    pressRunInformation: job.pressRunInformation,
    binderyInstructions: job.binderyInstructions,
    shippingInstructions: job.shippingInstructions,
    customerCompanyName: job.customerCompanyName,
    customerAddress: job.customerAddress,
    customerContactName: job.customerContactName,
    customerContactEmail: job.customerContactEmail,
  };

  return <JobTicketShell key={job.updatedAt.toISOString()} meta={meta} initial={initial} />;
}
