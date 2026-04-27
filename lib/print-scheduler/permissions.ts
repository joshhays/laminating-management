import type { SchedulerUser as User } from "@prisma/client";

export const ROLES = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER", "MACHINE"] as const;
export type AppRole = (typeof ROLES)[number];

export type PermissionKey =
  | "canViewSchedule"
  | "canEditSchedule"
  | "canImportJobs"
  | "canManageMachines"
  | "canViewCompletedTab"
  | "canViewCancelledTab"
  | "canManageUsers";

export function userHasPermission(user: User, key: PermissionKey): boolean {
  if (user.role === "ADMIN") return true;
  return Boolean(user[key]);
}

/** Apply preset flags for a role (ADMIN handled only in userHasPermission). */
export function permissionsForRole(role: string): Record<PermissionKey, boolean> {
  switch (role) {
    case "ADMIN":
      return {
        canViewSchedule: true,
        canEditSchedule: true,
        canImportJobs: true,
        canManageMachines: true,
        canViewCompletedTab: true,
        canViewCancelledTab: true,
        canManageUsers: true,
      };
    case "MANAGER":
      return {
        canViewSchedule: true,
        canEditSchedule: true,
        canImportJobs: true,
        canManageMachines: true,
        canViewCompletedTab: true,
        canViewCancelledTab: true,
        canManageUsers: false,
      };
    case "OPERATOR":
      return {
        canViewSchedule: true,
        canEditSchedule: true,
        canImportJobs: true,
        canManageMachines: false,
        canViewCompletedTab: true,
        canViewCancelledTab: false,
        canManageUsers: false,
      };
    case "MACHINE":
      return {
        canViewSchedule: true,
        canEditSchedule: true,
        canImportJobs: false,
        canManageMachines: false,
        canViewCompletedTab: true,
        canViewCancelledTab: false,
        canManageUsers: false,
      };
    case "VIEWER":
    default:
      return {
        canViewSchedule: true,
        canEditSchedule: false,
        canImportJobs: false,
        canManageMachines: false,
        canViewCompletedTab: false,
        canViewCancelledTab: false,
        canManageUsers: false,
      };
  }
}

type UserWithMachine = User & {
  machine?: { id: string; slug: string; name: string } | null;
};

export function toPublicUser(u: UserWithMachine) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    machineId: u.machineId ?? null,
    machine: u.machine
      ? { id: u.machine.id, slug: u.machine.slug, name: u.machine.name }
      : null,
    canViewSchedule: u.canViewSchedule,
    canEditSchedule: u.canEditSchedule,
    canImportJobs: u.canImportJobs,
    canManageMachines: u.canManageMachines,
    canViewCompletedTab: u.canViewCompletedTab,
    canViewCancelledTab: u.canViewCancelledTab,
    canManageUsers: u.canManageUsers,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
