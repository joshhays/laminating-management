import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/print-scheduler/auth";
import { userHasPermission, toPublicUser } from "@/lib/print-scheduler/permissions";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: toPublicUser(user),
    effective: {
      canViewSchedule: userHasPermission(user, "canViewSchedule"),
      canEditSchedule: userHasPermission(user, "canEditSchedule"),
      canImportJobs: userHasPermission(user, "canImportJobs"),
      canManageMachines: userHasPermission(user, "canManageMachines"),
      canViewCompletedTab: userHasPermission(user, "canViewCompletedTab"),
      canViewCancelledTab: userHasPermission(user, "canViewCancelledTab"),
      canManageUsers: userHasPermission(user, "canManageUsers"),
    },
  });
}
