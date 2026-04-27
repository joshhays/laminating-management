"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaperRefRow } from "@/lib/paper-ref";
import {
  type EstimateFormPrefill,
  type EstimateFormWorkflowBanner,
  type EstimatePrefillListItem,
  estimateToFormPrefill,
  formatEstimatePickLabel,
  type LaminationEntryMode,
} from "@/lib/estimate-workflow";
import type { CrmEstimateContext } from "@/lib/crm-estimate-context";
import { CompanyEstimateStep } from "./company-estimate-step";
import type { FilmOption } from "@/lib/estimate-film-option";
import type { MachineOption } from "./new-estimate-form";
import { NewEstimateForm } from "./new-estimate-form";

type Phase =
  | { step: "company" }
  | { step: "category" }
  | { step: "lamination-entry" }
  | { step: "after-press-source"; returnTo: "lamination-entry" | "category" }
  | { step: "form"; formKey: string };

type WorkflowFormLaunch = {
  formKey: string;
  prefill: EstimateFormPrefill | null;
  banner: EstimateFormWorkflowBanner;
};

export function EstimateWorkflowWizard({
  films,
  machines,
  paperRefRows,
  skidShippingSettings,
  recentEstimates,
}: {
  films: FilmOption[];
  machines: MachineOption[];
  paperRefRows: PaperRefRow[];
  skidShippingSettings: {
    pricePerSkidUsd: number;
    maxStackHeightInches: number;
    maxSkidWeightLbs: number;
  };
  recentEstimates: EstimatePrefillListItem[];
}) {
  const [phase, setPhase] = useState<Phase>({ step: "company" });
  const [crmContext, setCrmContext] = useState<CrmEstimateContext | null>(null);
  const [launch, setLaunch] = useState<WorkflowFormLaunch | null>(null);
  const [estimatePickId, setEstimatePickId] = useState("");

  useEffect(() => {
    if (phase.step !== "after-press-source") setEstimatePickId("");
  }, [phase]);

  const goToForm = useCallback((config: WorkflowFormLaunch) => {
    setLaunch(config);
    setPhase({ step: "form", formKey: config.formKey });
  }, []);

  const openStandaloneLamination = useCallback(() => {
    goToForm({
      formKey: "lamination-standalone",
      prefill: null,
      banner: {
        title: "Lamination quote — standalone",
        body: "Enter parent sheet size and quantity, then film and laminator. This path assumes you already know the run sheet (no prior estimate required).",
      },
    });
  }, [goToForm]);

  const openAfterPress = useCallback(
    (mode: "from-estimate" | "manual", estimate?: EstimatePrefillListItem) => {
      if (mode === "manual") {
        goToForm({
          formKey: "after-press-manual",
          prefill: null,
          banner: {
            title: "Lamination after printing — manual sheet specs",
            body: "Enter the sheet size and quantity coming off press (parent sheet for lamination). Film and trim options apply to those sheets.",
          },
        });
        return;
      }
      if (!estimate) return;
      const prefill = estimateToFormPrefill(estimate);
      goToForm({
        formKey: `after-press-${estimate.id}`,
        prefill,
        banner: {
          title: "Lamination after printing — from saved estimate",
          body: "Sizes, quantity, and paper below were copied from the estimate you picked. Adjust if the press run changed; then choose film and laminator.",
          sourceEstimateId: estimate.id,
          sourceEstimateNumber: estimate.estimateNumber,
        },
      });
    },
    [goToForm],
  );

  const handleBackFromForm = useCallback(() => {
    setLaunch(null);
    setPhase({ step: "category" });
  }, []);

  const handleCategoryPick = useCallback((cat: string) => {
    if (cat === "lamination") setPhase({ step: "lamination-entry" });
    else if (cat === "print-then-laminate")
      setPhase({ step: "after-press-source", returnTo: "category" });
  }, []);

  const handleLaminationEntry = useCallback(
    (mode: LaminationEntryMode) => {
      if (mode === "standalone") openStandaloneLamination();
      else setPhase({ step: "after-press-source", returnTo: "lamination-entry" });
    },
    [openStandaloneLamination],
  );

  const estimateOptions = useMemo(
    () =>
      recentEstimates.filter(
        (e) =>
          e.sheetLengthInches > 0 &&
          e.quantity > 0 &&
          (e.materialWidthInches == null || e.materialWidthInches > 0),
      ),
    [recentEstimates],
  );

  const selectedEstimate = estimateOptions.find((e) => e.id === estimatePickId);

  if (phase.step === "company") {
    return (
      <CompanyEstimateStep
        onContinue={(ctx) => {
          setCrmContext(ctx);
          setPhase({ step: "category" });
        }}
      />
    );
  }

  if (phase.step === "form" && launch) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBackFromForm}
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
          >
            ← Change workflow
          </button>
        </div>
        <NewEstimateForm
          key={launch.formKey}
          films={films}
          machines={machines}
          paperRefRows={paperRefRows}
          skidShippingSettings={skidShippingSettings}
          crmContext={crmContext}
          workflowBanner={launch.banner}
          prefill={launch.prefill}
        />
      </div>
    );
  }

  if (phase.step === "lamination-entry") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setPhase({ step: "category" })}
          className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back
        </button>
        {crmContext && (
          <p className="text-sm text-zinc-600">
            Quoting for{" "}
            <Link href={`/crm/accounts/${crmContext.companyId}`} className="font-medium text-zinc-900 underline">
              {crmContext.companyName}
            </Link>
            {" · "}
            {crmContext.contactFirstName} {crmContext.contactLastName}
            {crmContext.contactEmail?.trim()
              ? ` (${crmContext.contactEmail})`
              : " (no email)"}
          </p>
        )}
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Lamination — how are sheets defined?</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Next step depends on whether you already have parent sheet dimensions or they come from a press
            quote.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <button
              type="button"
              onClick={() => handleLaminationEntry("standalone")}
              className="flex h-full w-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="font-medium text-zinc-900">Standalone</span>
              <span className="mt-2 text-sm text-zinc-600">
                Next: enter sheet width × length and quantity, then film and machine. No prior estimate.
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => handleLaminationEntry("after-press")}
              className="flex h-full w-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="font-medium text-zinc-900">After a press run</span>
              <span className="mt-2 text-sm text-zinc-600">
                Next: pull sheet specs from a saved estimate or type them in, then lamination pricing loads
                on those sheets.
              </span>
            </button>
          </li>
        </ul>
      </div>
    );
  }

  if (phase.step === "after-press-source") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() =>
            setPhase(
              phase.returnTo === "lamination-entry"
                ? { step: "lamination-entry" }
                : { step: "category" },
            )
          }
          className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
        >
          ← Back
        </button>
        {crmContext && (
          <p className="text-sm text-zinc-600">
            Quoting for{" "}
            <Link href={`/crm/accounts/${crmContext.companyId}`} className="font-medium text-zinc-900 underline">
              {crmContext.companyName}
            </Link>
            {" · "}
            {crmContext.contactFirstName} {crmContext.contactLastName}
            {crmContext.contactEmail?.trim()
              ? ` (${crmContext.contactEmail})`
              : " (no email)"}
          </p>
        )}
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Sheets coming to the laminator</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Pull press-side numbers from an existing estimate snapshot (same parent sheet fields you use for
            film), or enter them manually. Only lamination is priced on this screen — print stays on your
            press quote if you track it separately.
          </p>
        </div>
        <ul className="grid gap-3 lg:grid-cols-2">
          <li className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="font-medium text-zinc-900">From a saved estimate</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Next: choose a recent quote; sheet size, quantity, and paper fields prefill the lamination
              form.
            </p>
            {estimateOptions.length === 0 ? (
              <p className="mt-3 text-sm text-amber-800">
                No recent estimates to import. Save a quote first, or use manual entry.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Estimate
                  </span>
                  <select
                    value={estimatePickId}
                    onChange={(e) => setEstimatePickId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">— Select —</option>
                    {estimateOptions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {formatEstimatePickLabel(e)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!selectedEstimate}
                  onClick={() =>
                    selectedEstimate && openAfterPress("from-estimate", selectedEstimate)
                  }
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  Continue with selected estimate
                </button>
              </div>
            )}
          </li>
          <li className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="font-medium text-zinc-900">Manual entry</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Next: full lamination form opens — enter press output sheets yourself (sizes, qty, paper).
            </p>
            <button
              type="button"
              onClick={() => openAfterPress("manual")}
              className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Enter sheet specs manually
            </button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Step 2 — What are you estimating?</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Pick a category — the next screen only shows options that apply. Department / machine selection
            is on the lamination form (spider web rules).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCrmContext(null);
            setPhase({ step: "company" });
          }}
          className="shrink-0 text-sm font-medium text-zinc-600 underline hover:text-zinc-900"
        >
          Change company
        </button>
      </div>
      {crmContext && (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
          <span className="font-medium">{crmContext.companyName}</span>
          {" · "}
          {crmContext.contactFirstName} {crmContext.contactLastName}
          {crmContext.contactEmail?.trim() ? (
            <>
              {" · "}
              <a href={`mailto:${crmContext.contactEmail}`} className="underline">
                {crmContext.contactEmail}
              </a>
            </>
          ) : (
            <span className="text-zinc-500"> · No email on file</span>
          )}
          {crmContext.priceTier ? (
            <span className="ml-2 text-zinc-500">
              (price tier: {crmContext.priceTier.toLowerCase()})
            </span>
          ) : null}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <button
            type="button"
            onClick={() => handleCategoryPick("lamination")}
            className="flex h-full w-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="font-medium text-zinc-900">Lamination</span>
            <span className="mt-2 text-sm font-medium text-[var(--dashboard-accent)]">
              Next options: standalone vs after press
            </span>
            <span className="mt-1 text-sm text-zinc-600">
              Film, laminator time, trim/cutter, skid pack — your current quoting tool.
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => handleCategoryPick("print-then-laminate")}
            className="flex h-full w-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="font-medium text-zinc-900">Print → laminate</span>
            <span className="mt-2 text-sm font-medium text-[var(--dashboard-accent)]">
              Next options: import estimate or manual sheets
            </span>
            <span className="mt-1 text-sm text-zinc-600">
              Reuse parent sheet fields from a saved quote, then price lamination for those sheets.
            </span>
          </button>
        </li>
        <li className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-5">
          <span className="font-medium text-zinc-700">Printing only</span>
          <span className="mt-2 block text-sm text-zinc-500">
            Next: press estimating is not in this flow yet. Use{" "}
            <Link href="/module-setup/estimating/press" className="font-medium underline">
              Press setup
            </Link>{" "}
            for equipment; use “Print → laminate” to chain sheet specs into a film quote.
          </span>
        </li>
        <li className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-5">
          <span className="font-medium text-zinc-700">Finishing / bindery</span>
          <span className="mt-2 block text-sm text-zinc-500">
            Next: configure equipment under Module setup → Finishing; combined workflows can extend here
            later.
          </span>
        </li>
        <li className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-5 sm:col-span-2">
          <span className="font-medium text-zinc-700">Mailing</span>
          <span className="mt-2 block text-sm text-zinc-500">
            Next: mailing setup lives under Module setup → Estimating → Mailing; quote hooks can follow.
          </span>
        </li>
      </ul>
    </div>
  );
}
