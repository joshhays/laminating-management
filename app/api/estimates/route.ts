import { NextResponse } from "next/server";
import { ActivityType, type Prisma } from "@prisma/client";
import {
  computeEstimateForCreate,
  type CrmContactForEstimate,
  type ComputeEstimateSuccess,
} from "@/lib/compute-estimate-for-create";
import { recordActivity } from "@/lib/crm-activity";
import { BUNDLE_PART_LABEL_MAX, MAX_BUNDLE_PARTS } from "@/lib/estimate-bundle";
import { nextBundleQuoteNumberForCreate, nextEstimateNumberForCreate } from "@/lib/estimate-number";
import { prisma } from "@/lib/prisma";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Merge one tab's fields over shared CRM + wrapper; drops `parts` from the parent. */
function mergeEstimatePartWithShared(
  part: Record<string, unknown>,
  shared: Record<string, unknown>,
): Record<string, unknown> {
  const { parts: _drop, ...rest } = shared;
  return { ...rest, ...part };
}

async function postBundledEstimates(
  sharedBody: Record<string, unknown>,
  parts: unknown[],
  companyId: string,
  contactId: string,
  crmContact: CrmContactForEstimate,
): Promise<Response> {
  const ctx = { companyId, contactId, crmContact };
  const computedList: ComputeEstimateSuccess[] = [];
  const partLabels: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    if (!isRecord(raw)) {
      return NextResponse.json({ error: `Part ${i + 1}: invalid object` }, { status: 400 });
    }
    const merged = mergeEstimatePartWithShared(raw, sharedBody);
    const labelRaw = raw.partLabel != null ? String(raw.partLabel).trim() : "";
    partLabels.push(labelRaw.slice(0, BUNDLE_PART_LABEL_MAX));
    const r = await computeEstimateForCreate(prisma, merged, ctx);
    if (!r.ok) {
      return NextResponse.json({ error: `Part ${i + 1}: ${r.error}` }, { status: r.status });
    }
    computedList.push(r);
  }

  const bundleAccounting = computedList.some((c) => c.accountingReviewRequired);
  const first = computedList[0]!;

  const { bundle, estimateIds } = await prisma.$transaction(async (tx) => {
    const quoteNumber = await nextBundleQuoteNumberForCreate(tx);
    const b = await tx.estimateBundle.create({
      data: {
        quoteNumber,
        companyId,
        contactId,
        accountingReviewRequired: bundleAccounting,
      },
    });

    const ids: string[] = [];
    for (let j = 0; j < computedList.length; j++) {
      const c = computedList[j]!;
      const label = partLabels[j] ?? "";
      const rowLabel = label.length > 0 ? label : computedList.length > 1 ? `Part ${j + 1}` : "";

      const data: Prisma.EstimateUncheckedCreateInput = {
        ...c.createData,
        estimateNumber: null,
        bundleId: b.id,
        bundleSortOrder: j,
        bundlePartLabel: rowLabel.length > 0 ? rowLabel : null,
        quoteLetterEdits: undefined,
      };

      const e = await tx.estimate.create({ data });
      ids.push(e.id);

      const estTitle =
        rowLabel.length > 0 ? `Quote #${quoteNumber} · ${rowLabel}` : `Quote #${quoteNumber}`;
      await recordActivity(tx, {
        type: ActivityType.ESTIMATE_CREATED,
        title: `${estTitle} saved`,
        body: `${crmContact.company.name} · $${c.totalCost.toFixed(2)} (multi-part quote)`,
        companyId: crmContact.companyId,
        contactId,
        estimateId: e.id,
        machineId: c.machineId,
        metadata: {
          quoteNumber,
          bundleId: b.id,
          bundlePartIndex: j,
          totalCost: c.totalCost,
          accountingReviewRequired: c.accountingReviewRequired,
        },
      });
    }

    return { bundle: b, estimateIds: ids };
  });

  return NextResponse.json(
    {
      bundleId: bundle.id,
      quoteNumber: bundle.quoteNumber,
      estimateIds,
      primaryEstimateId: estimateIds[0],
      estimateId: estimateIds[0],
      estimateNumber: null,
      estimatedLinearFeet: first.primary.estimatedLinearFeet,
      materialSquareInches: first.agg.totalMaterialSquareInches,
      filmFromRollSquareInches: first.agg.totalFilmFromRollSquareInches,
      totalCost: first.totalCost,
      filmMaterialCost: first.agg.totalCostFromFilm,
      estimatedMachineCost: first.estimatedMachineCost,
      estimatedLaborCost: first.estimatedLaborCost,
      estimatedCutCount: first.estimatedCutCount,
      estimatedCutterSheetsPerLift: first.estimatedCutterSheetsPerLift,
      estimatedCutterLiftCount: first.estimatedCutterLiftCount,
      estimatedCutterLaborHours: first.estimatedCutterLaborHours,
      estimatedCutterMachineOnlyCost: first.estimatedCutterMachineOnlyCost,
      estimatedCutterLaborOnlyCost: first.estimatedCutterLaborOnlyCost,
      estimatedCutterCost: first.estimatedCutterCost,
      estimatedSkidPackCost: first.estimatedSkidPackCost,
      estimatedSkidPackInboundSkids: first.estimatedSkidPackInboundSkids,
      estimatedSkidPackOutboundSkids: first.estimatedSkidPackOutboundSkids,
      skidPackPricePerSkidSnapshot: first.skidPackPricePerSkidSnapshot,
      accountingReviewRequired: bundleAccounting,
    },
    { status: 201 },
  );
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const body = rawBody;

    const companyId = body.companyId != null ? String(body.companyId).trim() : "";
    const contactId = body.contactId != null ? String(body.contactId).trim() : "";
    if (!companyId || !contactId) {
      return NextResponse.json(
        { error: "Select a company and contact before saving the estimate." },
        { status: 400 },
      );
    }

    const crmContact = await prisma.contact.findFirst({
      where: { id: contactId, companyId },
      include: { company: true },
    });
    if (!crmContact) {
      return NextResponse.json(
        { error: "Invalid company or contact. Go back and pick the customer again." },
        { status: 400 },
      );
    }

    const crm = crmContact as CrmContactForEstimate;

    const partsField = body.parts;
    if (Array.isArray(partsField) && partsField.length >= 2) {
      if (partsField.length > MAX_BUNDLE_PARTS) {
        return NextResponse.json(
          { error: `At most ${MAX_BUNDLE_PARTS} separate parts per quote.` },
          { status: 400 },
        );
      }
      return postBundledEstimates(body, partsField, companyId, contactId, crm);
    }

    const computed = await computeEstimateForCreate(prisma, body, {
      companyId,
      contactId,
      crmContact: crm,
    });
    if (!computed.ok) {
      return NextResponse.json({ error: computed.error }, { status: computed.status });
    }

    const estimate = await prisma.$transaction(async (tx) => {
      const estimateNumber = await nextEstimateNumberForCreate(tx);
      const e = await tx.estimate.create({
        data: { ...computed.createData, estimateNumber },
      });

      const estLabel =
        e.estimateNumber != null ? `Estimate #${e.estimateNumber}` : `Quote ${e.id.slice(0, 8)}…`;
      await recordActivity(tx, {
        type: ActivityType.ESTIMATE_CREATED,
        title: `${estLabel} saved`,
        body: `${crm.company.name} · $${computed.totalCost.toFixed(2)} total`,
        companyId: crm.companyId,
        contactId,
        estimateId: e.id,
        machineId: computed.machineId,
        metadata: {
          estimateNumber: e.estimateNumber,
          totalCost: computed.totalCost,
          accountingReviewRequired: computed.accountingReviewRequired,
        },
      });

      return e;
    });

    return NextResponse.json(
      {
        estimateId: estimate.id,
        estimateNumber: estimate.estimateNumber,
        estimatedLinearFeet: computed.primary.estimatedLinearFeet,
        materialSquareInches: computed.agg.totalMaterialSquareInches,
        filmFromRollSquareInches: computed.agg.totalFilmFromRollSquareInches,
        totalCost: computed.totalCost,
        filmMaterialCost: computed.agg.totalCostFromFilm,
        estimatedMachineCost: computed.estimatedMachineCost,
        estimatedLaborCost: computed.estimatedLaborCost,
        estimatedCutCount: computed.estimatedCutCount,
        estimatedCutterSheetsPerLift: computed.estimatedCutterSheetsPerLift,
        estimatedCutterLiftCount: computed.estimatedCutterLiftCount,
        estimatedCutterLaborHours: computed.estimatedCutterLaborHours,
        estimatedCutterMachineOnlyCost: computed.estimatedCutterMachineOnlyCost,
        estimatedCutterLaborOnlyCost: computed.estimatedCutterLaborOnlyCost,
        estimatedCutterCost: computed.estimatedCutterCost,
        estimatedSkidPackCost: computed.estimatedSkidPackCost,
        estimatedSkidPackInboundSkids: computed.estimatedSkidPackInboundSkids,
        estimatedSkidPackOutboundSkids: computed.estimatedSkidPackOutboundSkids,
        skidPackPricePerSkidSnapshot: computed.skidPackPricePerSkidSnapshot,
        accountingReviewRequired: computed.accountingReviewRequired,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
