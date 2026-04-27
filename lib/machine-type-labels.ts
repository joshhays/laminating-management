import type { MachineType } from "@prisma/client";
import { MachineTypeKind } from "@prisma/client";

/** Short suffix for machine type dropdowns and lists. */
export function machineTypeOptionSuffix(t: {
  kind: MachineTypeKind;
  pressTechnology?: string | null;
  finishingKind?: string | null;
}): string {
  if (t.kind === MachineTypeKind.PRESS && t.pressTechnology) {
    return ` (Press — ${t.pressTechnology.toLowerCase()})`;
  }
  if (t.kind === MachineTypeKind.FINISHING && t.finishingKind) {
    const fk = t.finishingKind.toLowerCase();
    return ` (Finishing — ${fk})`;
  }
  if (t.kind === MachineTypeKind.CUTTER) return " (Cutter)";
  if (t.kind === MachineTypeKind.LAMINATOR) return " (Laminator)";
  if (t.kind === MachineTypeKind.MAILING) return " (Mailing)";
  return "";
}

export function formatMachineTypeOptionLabel(t: MachineType): string {
  return `${t.name}${machineTypeOptionSuffix(t)}`;
}
