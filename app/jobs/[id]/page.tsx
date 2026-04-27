import Link from "next/link";
import { notFound } from "next/navigation";
import { JobTimeActivityKind } from "@prisma/client";
import { CustomFieldsEditor } from "@/components/crm/custom-fields-editor";
import { customFieldsToEntries } from "@/lib/crm-custom-fields";
import { conversionLaborCost, conversionMachineCost } from "@/lib/job-conversion-costs";
import {
  actualFilmUsdFromRunLogs,
  totalFilmLinearFeetForRun,
  totalFilmLinearFeetFromRunLogs,
} from "@/lib/job-film-from-sheets";
import { JobCollapsibleSection, JobNestedSubsection } from "@/components/jobs/job-collapsible-section";
import { prisma } from "@/lib/prisma";
import { isWorkflowLocked, workflowLabel } from "@/lib/workflow/job-workflow";
import { JobAdminEdits } from "./job-admin-edits";
import { JobFilmPurchaseClient } from "./job-film-purchase-client";
import { JobShippingEditor } from "./job-shipping-editor";
import { JobShopFloorClient } from "./job-shop-floor-client";
import { PullFilmButton } from "./pull-film-button";

function activityLabel(kind: JobTimeActivityKind) {
  return kind === JobTimeActivityKind.LINE_TIME ? "Run" : "Labor (legacy)";
}

function logDurationHours(startedAt: Date, endedAt: Date | null): string {
  if (!endedAt) return "Open";
  const h = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 3_600_000);
  return `${h.toLocaleString(undefined, { maximumFractionDigits: 2 })} hr`;
}

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

type PageProps = { params: Promise<{ id: string }> };

export default async function JobTicketPage({ params }: PageProps) {
  const { id } = await params;

  const job = await prisma.jobTicket.findUnique({
    where: { id },
    include: {
      estimate: {
        include: { filmRoll: true },
      },
      filmAllocations: {
        include: { filmInventory: true },
        orderBy: { passOrder: "asc" },
      },
      purchaseRequirements: {
        include: { filmInventory: true },
        orderBy: { createdAt: "desc" },
      },
      timeLogs: {
        include: { employee: true },
        orderBy: { startedAt: "desc" },
      },
      machine: true,
    },
  });

  if (!job) notFound();

  const workflowLocked = isWorkflowLocked(job);

  const allocs = job.filmAllocations;
  const pendingAllocs = allocs.filter((a) => a.status === "ALLOCATED");
  function allocCanPull(a: (typeof allocs)[number]) {
    const roll = a.filmInventory;
    if (roll == null) return false;
    if (roll.stockKind === "CATALOG") return true;
    return roll.remainingLinearFeet + 1e-9 >= a.allocatedLinearFeet;
  }
  const canPull =
    pendingAllocs.length > 0 && pendingAllocs.every(allocCanPull);
  const insufficientStock =
    pendingAllocs.length > 0 && pendingAllocs.some((a) => !allocCanPull(a));
  const alreadyPulled =
    allocs.length > 0 && allocs.every((a) => a.status === "PULLED");

  const jobCustomMap = Object.fromEntries(
    customFieldsToEntries(job.customFields).map((e) => [e.key, e.value]),
  );

  const scheduleLabel =
    job.scheduledStart != null && job.scheduledEnd != null
      ? `${new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(job.scheduledStart)} — ${new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(job.scheduledEnd)}`
      : null;

  const dueLabel =
    job.dueDate != null
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(job.dueDate)
      : null;

  const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

  const estimateForFilm =
    job.estimate != null
      ? {
          quantity: job.estimate.quantity,
          estimatedLinearFeet: job.estimate.estimatedLinearFeet,
          rollWidthSnapshotInches: job.estimate.rollWidthSnapshotInches,
          pricePerFilmSquareInch: job.estimate.pricePerFilmSquareInch,
          filmRoll: job.estimate.filmRoll,
        }
      : null;
  const activeAllocs = allocs.filter((a) => a.status !== "CANCELLED");
  const allocForFilm = activeAllocs.map((a) => ({
    allocatedLinearFeet: a.allocatedLinearFeet,
    filmInventory: {
      rollWidth: a.filmInventory.rollWidth,
      pricePerFilmSquareInch: a.filmInventory.pricePerFilmSquareInch,
    },
  }));
  const orderQtyForFilm = job.estimate != null && job.estimate.quantity >= 1 ? job.estimate.quantity : null;
  const actualFilmUsd = actualFilmUsdFromRunLogs(
    job.timeLogs,
    estimateForFilm,
    allocForFilm.length > 0 ? allocForFilm : null,
    orderQtyForFilm,
  );
  const totalFilmLinFtLogged =
    orderQtyForFilm != null && allocForFilm.length > 0
      ? totalFilmLinearFeetFromRunLogs(job.timeLogs, orderQtyForFilm, allocForFilm)
      : null;

  const costRates =
    job.machine != null
      ? { hourlyRate: job.machine.hourlyRate, laborHourlyRate: job.machine.laborHourlyRate }
      : null;
  const costMachineUsd = conversionMachineCost(job.actualRunTimeHours, costRates);
  const costLaborUsd = conversionLaborCost(job.actualRunTimeHours, costRates);
  const actualConversionTotalUsd = actualFilmUsd + costMachineUsd + costLaborUsd;

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="mb-8 print:hidden">
        <Link
          href="/jobs"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Jobs
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Job</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              {job.jobNumber != null ? (
                <>Job #{job.jobNumber}</>
              ) : (
                <span className="font-mono text-xl">{job.id}</span>
              )}
            </h1>
            {job.jobNumber != null && <p className="mt-1 font-mono text-xs text-zinc-500">{job.id}</p>}
            <p className="mt-2 text-sm text-zinc-600">
              Workflow:{" "}
              <span className="font-medium text-zinc-900">{workflowLabel(job.workflowStatus)}</span>
              {" · "}
              Line:{" "}
              <span className="font-medium text-zinc-900">{statusLabel(job.status)}</span>
              {job.estimate?.estimateNumber != null && (
                <>
                  {" "}
                  · Quote #{job.estimate.estimateNumber}
                </>
              )}
            </p>
            {workflowLocked ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                This job is complete and locked. Details are read-only; see{" "}
                <Link href="/jobs/reporting" className="font-medium underline">
                  Reporting
                </Link>{" "}
                for finished jobs.
              </p>
            ) : null}
            {(dueLabel || scheduleLabel) && (
              <div className="mt-2 space-y-1 text-sm text-zinc-600">
                {dueLabel ? (
                  <p>
                    Due: <span className="font-medium text-zinc-900">{dueLabel}</span>
                  </p>
                ) : null}
                {scheduleLabel ? <p>Schedule: {scheduleLabel}</p> : null}
              </div>
            )}
          </div>
          <Link
            href={`/jobs/${job.id}/job-ticket`}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            Job ticket
          </Link>
        </div>
      </header>

      {job.purchaseRequirements.length > 0 && (
        <section className="mb-10 rounded-xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <h2 className="text-sm font-medium text-amber-950">Purchase requirements</h2>
          <p className="mt-1 text-xs text-amber-900/80">
            Raised when approving the quote or entering purchasing if floor film is short for the
            allocation.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-amber-950">
            {job.purchaseRequirements.map((pr) => (
              <li key={pr.id} className="rounded-lg border border-amber-200/80 bg-white/80 px-3 py-2">
                {pr.description}
                {pr.linearFeetShort != null && pr.linearFeetShort > 0 && (
                  <span className="ml-1 tabular-nums text-amber-900/90">
                    (short ~{pr.linearFeetShort.toFixed(1)} lin. ft)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <JobFilmPurchaseClient jobId={job.id} />

      <JobCollapsibleSection
        step={1}
        title="Shipping & delivery"
        description="Where and how finished work leaves the shop."
        defaultOpen={!job.shippingInstructions?.trim()}
      >
        <JobShippingEditor
          key={`${job.updatedAt.toISOString()}-shipping`}
          jobId={job.id}
          initialShippingInstructions={job.shippingInstructions}
          readOnly={workflowLocked}
        />
      </JobCollapsibleSection>

      <JobCollapsibleSection
        step={2}
        title="Shop floor"
        description="Film allocations, pull, time logs, costs, and machine assignment."
        defaultOpen={Boolean(job.shippingInstructions?.trim())}
      >
        <JobNestedSubsection title="Film allocation & pull" defaultOpen={allocs.length > 0}>
          {allocs.length > 0 ? (
          <div className="space-y-4">
            {allocs.map((allocation) => {
              const rollForJob = allocation.filmInventory;
              const snapshotFt =
                allocation.estimatedLinearFeetSnapshot ?? allocation.allocatedLinearFeet;
              const currentAllocFt = allocation.allocatedLinearFeet;
              const allocDiffersFromSnapshot =
                allocation.estimatedLinearFeetSnapshot != null &&
                Math.abs(allocation.estimatedLinearFeetSnapshot - currentAllocFt) > 1e-6;
              const rollRemaining = rollForJob?.remainingLinearFeet ?? null;
              const allocStatus = allocation.status;
              return (
                <div
                  key={allocation.id}
                  className="rounded-lg border border-zinc-100 bg-zinc-50 p-4"
                >
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Film allocation
                    {allocs.length > 1 ? ` (pass ${allocation.passOrder})` : ""}
                  </h3>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-zinc-500">Estimate snapshot (at conversion)</dt>
                      <dd className="font-semibold tabular-nums text-zinc-900">
                        {snapshotFt.toLocaleString(undefined, { maximumFractionDigits: 2 })} lin. ft
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Current allocation</dt>
                      <dd className="font-semibold tabular-nums text-zinc-900">
                        {currentAllocFt.toLocaleString(undefined, { maximumFractionDigits: 2 })} lin. ft
                        {allocDiffersFromSnapshot && (
                          <span className="ml-2 text-xs font-normal text-amber-800">
                            (differs from snapshot — approve at end-of-day pull)
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Allocation status</dt>
                      <dd className="font-medium text-zinc-900">
                        {allocStatus === "ALLOCATED"
                          ? "Allocated (not yet pulled)"
                          : allocStatus === "PULLED"
                            ? "Pulled"
                            : allocStatus === "CANCELLED"
                              ? "Cancelled"
                              : allocStatus}
                      </dd>
                    </div>
                    {rollForJob && (
                      <div className="sm:col-span-2">
                        <dt className="text-zinc-500">Roll</dt>
                        <dd className="text-zinc-900">
                          {rollForJob.stockKind === "CATALOG" ? (
                            <>
                              <span className="font-medium text-zinc-800">Catalog</span>
                              {rollForJob.vendor ? (
                                <>
                                  {" "}
                                  · Vendor: {rollForJob.vendor}
                                </>
                              ) : null}
                              {" · "}
                              {rollForJob.description} · {rollForJob.rollWidth}&Prime; ×{" "}
                              {rollForJob.thicknessMil} mil (order for job; not held on floor)
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-zinc-800">On-floor</span>
                              {rollForJob.vendor ? (
                                <>
                                  {" "}
                                  · Vendor: {rollForJob.vendor}
                                </>
                              ) : null}
                              {" · "}
                              {rollForJob.description} · {rollForJob.rollWidth}&Prime; ×{" "}
                              {rollForJob.thicknessMil} mil ·{" "}
                              {rollRemaining?.toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
                              lin. ft on hand
                            </>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
            <div className="mt-4 space-y-2">
              {!workflowLocked && (
              <PullFilmButton
                jobId={job.id}
                canPull={canPull}
                insufficientStock={Boolean(insufficientStock)}
                alreadyPulled={alreadyPulled}
                cancelled={allocs.every((a) => a.status === "CANCELLED")}
              />
              )}
              <p className="text-xs text-zinc-500">
                For end-of-day verification of all pending pulls, use{" "}
                <Link href="/inventory/pull-batch" className="font-medium text-zinc-700 underline">
                  Inventory → End-of-day pull
                </Link>
                .
              </p>
            </div>
          </div>
          ) : (
            <p className="text-sm text-zinc-500">No film allocations on this job.</p>
          )}
        </JobNestedSubsection>

        <JobNestedSubsection title="Time on job & logs" defaultOpen={job.timeLogs.length > 0}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Run & labor entries
            </span>
            <Link
              href="/shop-floor"
              className="text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
            >
              Open shop floor
            </Link>
          </div>
          {job.timeLogs.length === 0 ? (
            <p className="text-sm text-zinc-500">No time logs yet. Start tracking on the shop floor.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Who</th>
                    <th className="px-3 py-2">Activity</th>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Ended</th>
                    <th className="px-3 py-2 text-right">Duration</th>
                    <th className="px-3 py-2 text-right">Sheets</th>
                    <th className="px-3 py-2 text-right">Film (lin ft)</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {job.timeLogs.map((log) => (
                    <tr key={log.id} className="bg-white">
                      <td className="px-3 py-2 font-medium text-zinc-900">{log.employee.name}</td>
                      <td className="px-3 py-2 text-zinc-700">{activityLabel(log.activityKind)}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600">{dateTimeFmt.format(log.startedAt)}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600">
                        {log.endedAt ? dateTimeFmt.format(log.endedAt) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {logDurationHours(log.startedAt, log.endedAt)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {log.activityKind === JobTimeActivityKind.LINE_TIME && log.sheetsRun != null
                          ? log.sheetsRun.toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                        {log.activityKind === JobTimeActivityKind.LINE_TIME &&
                        log.sheetsRun != null &&
                        log.endedAt != null &&
                        orderQtyForFilm != null &&
                        allocForFilm.length > 0
                          ? totalFilmLinearFeetForRun(log.sheetsRun, orderQtyForFilm, allocForFilm).toLocaleString(
                              undefined,
                              { maximumFractionDigits: 2 },
                            )
                          : "—"}
                      </td>
                      <td className="max-w-[12rem] px-3 py-2 text-zinc-600">
                        {log.notes?.trim() ? (
                          <span className="line-clamp-2 whitespace-pre-wrap">{log.notes}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!workflowLocked && (
          <JobAdminEdits
            jobId={job.id}
            filmAllocations={job.filmAllocations.map((a) => ({
              id: a.id,
              passOrder: a.passOrder,
              status: a.status,
              allocatedLinearFeet: a.allocatedLinearFeet,
              estimatedLinearFeetSnapshot: a.estimatedLinearFeetSnapshot,
            }))}
            timeLogs={job.timeLogs.map((log) => ({
              id: log.id,
              activityKind: log.activityKind,
              startedAt: log.startedAt.toISOString(),
              endedAt: log.endedAt?.toISOString() ?? null,
              sheetsRun: log.sheetsRun,
              notes: log.notes,
              employeeName: log.employee.name,
            }))}
          />
          )}
        </JobNestedSubsection>

        <JobNestedSubsection title="Conversion cost & machine">
          {(actualFilmUsd > 0 ||
            job.actualRunTimeHours != null ||
            job.actualLaborHours != null) && (
            <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm">
              <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Actual conversion cost
              </h4>
              <p className="mt-1 text-xs text-zinc-500">
                Film from sheets ran on each run (same ft/sheet ratio as the quote × roll width × $/MSI). Machine
                and operator dollars both use total run hours × assigned machine rates.
                {job.estimate == null && (
                  <span className="font-medium text-amber-800">
                    {" "}
                    Link a job to a quote to value film from sheet counts.
                  </span>
                )}
                {job.machine == null && (
                  <span className="font-medium text-amber-800">
                    {" "}
                    Assign a machine below to see machine and labor dollars.
                  </span>
                )}
              </p>
              <dl className="mt-3 grid gap-2 tabular-nums sm:grid-cols-2">
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-zinc-600">Film (from sheets ran)</dt>
                  <dd className="font-medium text-zinc-900">
                    $
                    {actualFilmUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    {totalFilmLinFtLogged != null && totalFilmLinFtLogged > 0 && (
                      <span className="ml-2 font-normal text-zinc-500">
                        · {totalFilmLinFtLogged.toLocaleString(undefined, { maximumFractionDigits: 2 })} lin ft
                        total
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">Machine / line</dt>
                  <dd className="font-medium text-zinc-900">
                    $
                    {costMachineUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">Labor</dt>
                  <dd className="font-medium text-zinc-900">
                    $
                    {costLaborUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-zinc-200 pt-2 sm:col-span-2">
                  <dt className="font-medium text-zinc-800">Total</dt>
                  <dd className="font-semibold text-zinc-900">
                    $
                    {actualConversionTotalUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
              </dl>
            </div>
          )}

        {!workflowLocked && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Machine & labor
          </h3>
          <JobShopFloorClient
            key={`${job.updatedAt.toISOString()}-${actualFilmUsd}-${job.actualRunTimeHours ?? "x"}`}
            jobId={job.id}
            initialMachineId={job.machineId}
            initialOperatorNotes={job.operatorNotes}
            trackedRunHours={job.actualRunTimeHours}
            actualFilmUsd={actualFilmUsd}
          />
        </div>
        )}
        </JobNestedSubsection>
      </JobCollapsibleSection>

      {job.estimate && (
        <JobCollapsibleSection
          step={3}
          title="Estimate snapshot"
          description="Quoted film, sheet size, and totals from the linked quote."
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Linked quote</span>
            <Link
              href={`/estimates/${job.estimate.id}`}
              className="text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
            >
              View estimate
              {job.estimate.estimateNumber != null
                ? ` #${job.estimate.estimateNumber}`
                : ""}
            </Link>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Film</dt>
              <dd className="text-zinc-900">{job.estimate.filmType}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Sheet length</dt>
              <dd className="font-medium text-zinc-900">
                {job.estimate.sheetLengthInches} in (feed direction)
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Quantity</dt>
              <dd className="font-medium text-zinc-900">{job.estimate.quantity} sheets</dd>
            </div>
            {job.estimate.includesFinalDelivery && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Final delivery</dt>
                <dd className="text-zinc-900">
                  <span className="font-medium">Included</span>
                  {job.estimate.finalDeliveryNotes != null &&
                    job.estimate.finalDeliveryNotes.trim() !== "" && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
                        {job.estimate.finalDeliveryNotes}
                      </p>
                    )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-zinc-500">Est. linear feet</dt>
              <dd className="font-medium tabular-nums text-zinc-900">
                {job.estimate.estimatedLinearFeet.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                ft
              </dd>
            </div>
            {job.estimate.materialWidthInches != null && (
              <>
                <div>
                  <dt className="text-zinc-500">Sheet / laminate width</dt>
                  <dd className="tabular-nums text-zinc-900">
                    {job.estimate.materialWidthInches} in sheet /{" "}
                    {job.estimate.laminateWidthInches ?? "—"} in film
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Roll / slit excess</dt>
                  <dd className="tabular-nums text-zinc-900">
                    {job.estimate.rollWidthSnapshotInches ?? "—"} in roll
                    {job.estimate.slitExcessWidthInches != null &&
                    job.estimate.slitExcessWidthInches > 0
                      ? ` (${job.estimate.slitExcessWidthInches} in slit)`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Sheet sq in (ref) / film off roll (priced)</dt>
                  <dd className="tabular-nums text-zinc-900">
                    {job.estimate.materialSquareInches?.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    }) ?? "—"}{" "}
                    /{" "}
                    {job.estimate.filmFromRollSquareInches?.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    }) ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Estimate total (film + est. machine + labor)</dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">
                    $
                    {job.estimate.totalCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
              </>
            )}
            {job.estimate.filmRoll && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Roll on hand</dt>
                <dd className="text-zinc-900">
                  {job.estimate.filmRoll.remainingLinearFeet.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{" "}
                  lin. ft remaining (not auto-deducted)
                </dd>
              </div>
            )}
          </dl>
        </JobCollapsibleSection>
      )}

      <JobCollapsibleSection
        step={job.estimate ? 4 : 3}
        title="Job notes & custom fields"
        description="Rush flags, gate codes, carrier prefs, and other per-job fields."
      >
        <CustomFieldsEditor
          title=""
          helper="Per-job notes the shop adds without a deploy (rush flags, gate codes, carrier prefs, etc.)."
          initialMap={jobCustomMap}
          saveUrl={`/api/job-tickets/${job.id}`}
          readOnly={workflowLocked}
        />
      </JobCollapsibleSection>

    </div>
  );
}
