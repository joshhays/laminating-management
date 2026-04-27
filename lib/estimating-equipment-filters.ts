import { MachineTypeKind } from "@prisma/client";

export type EstimatingEquipmentSection =
  | "laminating"
  | "press"
  | "finishing"
  | "mailing";

export function machineMatchesEstimatingSection(
  mt: { kind: MachineTypeKind } | null | undefined,
  section: EstimatingEquipmentSection,
): boolean {
  switch (section) {
    case "laminating":
      return !mt || mt.kind === MachineTypeKind.LAMINATOR;
    case "press":
      return mt?.kind === MachineTypeKind.PRESS;
    case "finishing":
      if (!mt) return false;
      return mt.kind === MachineTypeKind.CUTTER || mt.kind === MachineTypeKind.FINISHING;
    case "mailing":
      return mt?.kind === MachineTypeKind.MAILING;
    default:
      return false;
  }
}

export function machineTypeMatchesSection(
  t: { kind: MachineTypeKind },
  section: EstimatingEquipmentSection,
): boolean {
  return machineMatchesEstimatingSection(t, section);
}
