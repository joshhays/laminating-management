import Link from "next/link";
import { PrintSchedulerLink } from "@/components/print-scheduler-link";
import { getFilmMaterialLabelMap } from "@/lib/film-material-service";
import type { PaperRefRow } from "@/lib/paper-ref";
import { loadPaperRefRowsSync } from "@/lib/paper-ref-load";
import type { EstimatePrefillListItem } from "@/lib/estimate-workflow";
import {
  DEFAULT_MAX_SKID_WEIGHT_LBS,
  DEFAULT_MAX_STACK_HEIGHT_INCHES,
} from "@/lib/skid-pack-estimate";
import { prisma } from "@/lib/prisma";
import { EstimateWorkflowWizard } from "./estimate-workflow-wizard";

export const dynamic = "force-dynamic";

export default async function NewEstimatePage() {
  let paperRefRows: PaperRefRow[] = [];
  try {
    paperRefRows = loadPaperRefRowsSync();
  } catch {
    paperRefRows = [];
  }

  const labelMap = await getFilmMaterialLabelMap();
  const filmsRaw = await prisma.filmInventory.findMany({
    orderBy: { createdAt: "desc" },
  });
  const films = filmsRaw.map((f) => ({
    ...f,
    materialTypeLabel: labelMap.get(f.materialType) ?? f.materialType,
  }));

  const machines = await prisma.machine.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      machineType: true,
      speedReductionRules: { orderBy: { sortOrder: "asc" } },
      spoilageRules: { orderBy: { sortOrder: "asc" } },
    },
  });

  const skidPackRow = await prisma.skidPackSettings.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      pricePerSkidUsd: 0,
      maxStackHeightInches: DEFAULT_MAX_STACK_HEIGHT_INCHES,
      maxSkidWeightLbs: DEFAULT_MAX_SKID_WEIGHT_LBS,
    },
    update: {},
  });
  const skidMaxStackH =
    Number.isFinite(skidPackRow.maxStackHeightInches) && skidPackRow.maxStackHeightInches > 0
      ? skidPackRow.maxStackHeightInches
      : DEFAULT_MAX_STACK_HEIGHT_INCHES;
  const skidMaxWeightLb =
    Number.isFinite(skidPackRow.maxSkidWeightLbs) && skidPackRow.maxSkidWeightLbs > 0
      ? skidPackRow.maxSkidWeightLbs
      : DEFAULT_MAX_SKID_WEIGHT_LBS;

  const recentRaw = await prisma.estimate.findMany({
    take: 50,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      estimateNumber: true,
      materialWidthInches: true,
      sheetLengthInches: true,
      quantity: true,
      paperDescription: true,
      paperGsm: true,
      stockType: true,
      printType: true,
      paperColor: true,
      finalSheetWidthInches: true,
      finalSheetLengthInches: true,
      sheetThicknessInches: true,
      finalTrimIsPressReady: true,
      laminateWidthInsetInches: true,
    },
  });
  const recentEstimates: EstimatePrefillListItem[] = recentRaw.map((r) => ({
    id: r.id,
    estimateNumber: r.estimateNumber,
    materialWidthInches: r.materialWidthInches,
    sheetLengthInches: r.sheetLengthInches,
    quantity: r.quantity,
    paperDescription: r.paperDescription,
    paperGsm: r.paperGsm,
    stockType: r.stockType,
    printType: r.printType,
    paperColor: r.paperColor,
    finalSheetWidthInches: r.finalSheetWidthInches,
    finalSheetLengthInches: r.finalSheetLengthInches,
    sheetThicknessInches: r.sheetThicknessInches,
    finalTrimIsPressReady: r.finalTrimIsPressReady === true,
    laminateWidthInsetInches: r.laminateWidthInsetInches,
  }));

  return (
    <div className="new-estimate-page mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Home
          </Link>
          <PrintSchedulerLink className="text-sm font-medium text-sky-700 hover:text-sky-900">
            Print schedule →
          </PrintSchedulerLink>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New estimate</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Choose what you are quoting first — options after that match the workflow (lamination, print →
          laminate, and placeholders for print-only, finishing, and mailing). For lamination, cross-web margin is
          on the Press sheet step: at least ½&quot; total (¼&quot; per side) when slitting is required; larger when
          the roll matches laminate with no slit trim. Film is priced in $/MSI on the roll in inventory.
        </p>
      </header>
      <EstimateWorkflowWizard
        films={films}
        machines={machines}
        paperRefRows={paperRefRows}
        skidShippingSettings={{
          pricePerSkidUsd: skidPackRow.pricePerSkidUsd,
          maxStackHeightInches: skidMaxStackH,
          maxSkidWeightLbs: skidMaxWeightLb,
        }}
        recentEstimates={recentEstimates}
      />
    </div>
  );
}
