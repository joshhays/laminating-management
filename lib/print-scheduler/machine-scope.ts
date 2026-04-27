import type { Prisma } from "@prisma/client";
import type { SchedulerUser as User } from "@prisma/client";

export function isMachineRoleUser(user: Pick<User, "role">): boolean {
  return user.role === "MACHINE";
}

/** `where` clause for jobs list: MACHINE users only see jobs on their assigned press. */
export function jobsWhereForUser(
  user: Pick<User, "role" | "machineId">,
): Prisma.PrintScheduleJobWhereInput {
  if (isMachineRoleUser(user)) {
    if (!user.machineId) {
      return { id: { in: [] } };
    }
    return { machineId: user.machineId };
  }
  return {};
}

export function jobAccessibleByUser(
  user: Pick<User, "role" | "machineId">,
  jobMachineId: string | null,
): boolean {
  if (!isMachineRoleUser(user)) return true;
  if (!user.machineId) return false;
  return jobMachineId === user.machineId;
}

export function machineSlugAllowedForUser(
  user: Pick<User, "role" | "machineId">,
  targetMachineId: string,
): boolean {
  if (!isMachineRoleUser(user)) return true;
  return user.machineId === targetMachineId;
}
