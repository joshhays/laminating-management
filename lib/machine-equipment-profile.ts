import { MachineTypeKind } from "@prisma/client";

export type MachineTypeBrief = {
  kind: MachineTypeKind;
  finishingKind?: string | null;
  pressTechnology?: string | null;
};

export function usesCutterEstimateFields(mt: MachineTypeBrief | null | undefined): boolean {
  if (!mt) return false;
  if (mt.kind === MachineTypeKind.CUTTER) return true;
  if (mt.kind === MachineTypeKind.FINISHING) {
    return (mt.finishingKind ?? "").trim().toUpperCase() === "CUTTER";
  }
  return false;
}

/** Laminator picker on estimates / jobs (excludes press, finishing, mailing). */
export function isLaminatorForEstimates(mt: MachineTypeBrief | null | undefined): boolean {
  if (!mt) return true;
  return mt.kind === MachineTypeKind.LAMINATOR;
}

/** Machines eligible for the laminating week grid (not cutters, press, etc.). */
export function isLaminatingScheduleMachine(mt: MachineTypeBrief | null | undefined): boolean {
  if (!mt) return true;
  return mt.kind === MachineTypeKind.LAMINATOR;
}

export function usesSimpleEquipmentProfile(mt: MachineTypeBrief | null | undefined): boolean {
  if (!mt) return false;
  if (mt.kind === MachineTypeKind.MAILING) return true;
  if (mt.kind === MachineTypeKind.FINISHING) {
    return (mt.finishingKind ?? "").trim().toUpperCase() !== "CUTTER";
  }
  return false;
}

/** Laminator or press: needs web width + line speed on create. */
export function usesLaminatorLineFieldsCreate(mt: MachineTypeBrief | null | undefined): boolean {
  if (!mt) return true;
  return mt.kind === MachineTypeKind.LAMINATOR || mt.kind === MachineTypeKind.PRESS;
}

/** Prisma `where` fragment: active cutters used for trim estimates (legacy CUTTER or FINISHING+CUTTER). */
export function autoCutterWhereClause() {
  return {
    OR: [
      { machineType: { is: { kind: MachineTypeKind.CUTTER } } },
      {
        machineType: {
          is: {
            kind: MachineTypeKind.FINISHING,
            finishingKind: "CUTTER",
          },
        },
      },
    ],
  };
}
