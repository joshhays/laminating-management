import type { Estimate, EstimateLine, FilmInventory, Machine } from "@prisma/client";

export type EstimateWithJobTicketRelations = Estimate & {
  lines: EstimateLine[];
  machine: Machine | null;
  cutterMachine: Machine | null;
  filmRoll: FilmInventory | null;
  secondFilmRoll: FilmInventory | null;
};

function filmRollLine(prefix: string, roll: FilmInventory | null | undefined): string {
  if (!roll) return `${prefix}: —`;
  const kind = roll.stockKind === "CATALOG" ? "Catalog" : "On-floor";
  const v = roll.vendor?.trim() ? ` · ${roll.vendor.trim()}` : "";
  const mat = roll.materialType?.trim() ? ` · ${roll.materialType.trim()}` : "";
  return `${prefix}: ${kind}${v}${mat} · ${roll.description} · ${roll.rollWidth}" × ${roll.thicknessMil} mil`;
}

export function buildLaminationJobTicketSnapshot(
  estimate: EstimateWithJobTicketRelations,
): {
  ticketTitle: string;
  ticketDescriptionAdditional: string;
  customerCompanyName: string | null;
  customerAddress: string | null;
  customerContactName: string | null;
  customerContactEmail: string | null;
  stockInformation: string;
  filmInformation: string;
  pressRunInformation: string;
  binderyInstructions: string;
  shippingInstructions: string;
} {
  const titleParts: string[] = [];
  if (estimate.bundlePartLabel?.trim()) {
    titleParts.push(estimate.bundlePartLabel.trim());
  }
  titleParts.push(estimate.sheetSize.trim() || "Lamination job");
  const ticketTitle = titleParts.filter(Boolean).join(" — ");

  const lineParts = estimate.lines.map((l) => {
    const lab = l.label.trim() ? l.label.trim() : "Part";
    return `${lab}: ${l.quantity.toLocaleString()} sheets`;
  });
  const ticketDescriptionAdditional =
    lineParts.length > 0 ? `Order lines:\n${lineParts.join("\n")}` : "";

  const stockLines = [
    `Stock category: ${estimate.stockType?.trim() || "—"}`,
    `Paper: ${estimate.paperDescription?.trim() || "—"}`,
    estimate.paperGsm != null && Number.isFinite(estimate.paperGsm)
      ? `Paper weight: ${estimate.paperGsm} GSM`
      : null,
    `Sheet color: ${estimate.paperColor}`,
    `Print process: ${estimate.printType?.trim() || "—"}`,
    estimate.materialWidthInches != null
      ? `Parent sheet: ${estimate.materialWidthInches} × ${estimate.sheetLengthInches} in`
      : `Sheet length (feed): ${estimate.sheetLengthInches} in`,
    estimate.sheetThicknessInches != null &&
    Number.isFinite(estimate.sheetThicknessInches) &&
    estimate.sheetThicknessInches > 0
      ? `Substrate caliper: ${estimate.sheetThicknessInches} in / sheet`
      : null,
    `Order quantity: ${estimate.quantity.toLocaleString()} sheets (run)`,
    estimate.spoilageAllowanceSheets > 0
      ? `Spoilage allowance: +${estimate.spoilageAllowanceSheets} sheets`
      : null,
  ].filter(Boolean);
  const stockInformation = stockLines.join("\n");

  const filmLines = [
    `Quoted film line: ${estimate.filmType.trim() || "—"}`,
    filmRollLine("Primary roll", estimate.filmRoll),
    estimate.secondPassEnabled
      ? estimate.secondFilmSameAsFirst
        ? "Second pass: same film as pass 1"
        : filmRollLine("Second pass roll", estimate.secondFilmRoll)
      : "Second pass: no",
    estimate.passCount >= 2
      ? `Passes on laminator: ${estimate.passCount}`
      : `Passes on laminator: 1`,
  ];
  const filmInformation = filmLines.join("\n");

  const pressLines = [
    `Laminator: ${estimate.machine?.name?.trim() || "—"}`,
    `Estimated run time: ${
      estimate.estimatedRunTimeMinutes != null &&
      Number.isFinite(estimate.estimatedRunTimeMinutes) &&
      estimate.estimatedRunTimeMinutes > 0
        ? `${Math.round(estimate.estimatedRunTimeMinutes)} min`
        : "—"
    }`,
    `Est. linear feet (ref, one pass): ${
      Number.isFinite(estimate.estimatedLinearFeet)
        ? estimate.estimatedLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : "—"
    } ft`,
    estimate.effectiveLineSpeedMpm != null &&
    Number.isFinite(estimate.effectiveLineSpeedMpm) &&
    estimate.effectiveLineSpeedMpm > 0
      ? `Effective line speed (est.): ${estimate.effectiveLineSpeedMpm.toFixed(2)} m/min`
      : null,
    estimate.laminateWidthInches != null
      ? `Laminate width: ${estimate.laminateWidthInches} in`
      : null,
    estimate.rollWidthSnapshotInches != null
      ? `Film roll width (snapshot): ${estimate.rollWidthSnapshotInches} in`
      : null,
  ].filter(Boolean);
  const pressRunInformation = pressLines.join("\n");

  const hasTrim =
    estimate.finalSheetWidthInches != null &&
    estimate.finalSheetLengthInches != null &&
    estimate.finalSheetWidthInches > 0 &&
    estimate.finalSheetLengthInches > 0;
  const hasCuts =
    estimate.estimatedCutCount != null &&
    Number.isInteger(estimate.estimatedCutCount) &&
    estimate.estimatedCutCount > 0;

  let binderyInstructions: string;
  if (!hasTrim && !hasCuts) {
    binderyInstructions =
      "No separate final trim / cutter on this estimate (run sheet matches finished size).";
  } else {
    const b = [
      estimate.cutterMachine?.name?.trim()
        ? `Cutter: ${estimate.cutterMachine.name.trim()}`
        : estimate.cutterMachineId
          ? "Cutter: (assigned)"
          : null,
      hasTrim
        ? `Final trim: ${estimate.finalSheetWidthInches} × ${estimate.finalSheetLengthInches} in`
        : null,
      estimate.finalTrimPiecesPerSheet > 1
        ? `Pieces per sheet at trim: ${estimate.finalTrimPiecesPerSheet}-up`
        : null,
      estimate.estimatedCutCount != null
        ? `Est. cut count (incl. spoilage): ${estimate.estimatedCutCount}`
        : null,
      estimate.estimatedCutterLiftCount != null && estimate.estimatedCutterLiftCount > 0
        ? `Est. lifts: ${estimate.estimatedCutterLiftCount} (≈ ${estimate.estimatedCutterSheetsPerLift ?? "—"} sheets/lift)`
        : null,
      `Trim layout: ${estimate.finalTrimNoBleedDutchCut ? "Dutch / no bleed" : "Bleed"}${
        estimate.finalTrimIsPressReady ? ", press-ready sheet" : ""
      }${estimate.finalTrimImpositionRotated ? ", imposition rotated" : ""}`,
      estimate.estimatedFinishedPieceCount != null
        ? `Est. finished pieces: ${estimate.estimatedFinishedPieceCount.toLocaleString()}`
        : null,
    ].filter(Boolean);
    binderyInstructions = b.join("\n");
  }

  const shipParts: string[] = [];
  shipParts.push(
    estimate.includesFinalDelivery
      ? "Final delivery: included in quote"
      : "Final delivery: not included on estimate",
  );
  if (estimate.includesFinalDelivery && estimate.finalDeliveryNotes?.trim()) {
    shipParts.push(`Delivery notes: ${estimate.finalDeliveryNotes.trim()}`);
  }
  if (estimate.finalDeliveryCostUsd != null && estimate.finalDeliveryCostUsd > 0) {
    shipParts.push(
      `Delivery charge (snapshot): $${estimate.finalDeliveryCostUsd.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
  }
  if (estimate.skidPackEnabled) {
    shipParts.push(
      `Skid pack: yes — est. inbound skids ${estimate.estimatedSkidPackInboundSkids ?? "—"}, outbound ${estimate.estimatedSkidPackOutboundSkids ?? "—"}`,
    );
    if (
      estimate.skidPackPricePerSkidSnapshot != null &&
      estimate.skidPackPricePerSkidSnapshot > 0
    ) {
      shipParts.push(
        `Skid price (snapshot): $${estimate.skidPackPricePerSkidSnapshot.toFixed(2)} / skid`,
      );
    }
  } else {
    shipParts.push("Skid pack: not on estimate");
  }
  const shippingInstructions = shipParts.join("\n");

  return {
    ticketTitle,
    ticketDescriptionAdditional,
    customerCompanyName: estimate.quoteCompanyName?.trim() || null,
    customerAddress: estimate.quoteCompanyAddress?.trim() || null,
    customerContactName: estimate.quoteContactName?.trim() || null,
    customerContactEmail: estimate.quoteContactEmail?.trim() || null,
    stockInformation,
    filmInformation,
    pressRunInformation,
    binderyInstructions,
    shippingInstructions,
  };
}
