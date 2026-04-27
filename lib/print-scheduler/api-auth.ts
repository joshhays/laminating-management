import { NextResponse } from "next/server";
import { getSessionUser, type SchedulerSessionUser } from "@/lib/print-scheduler/auth";
import { userHasPermission, type PermissionKey } from "@/lib/print-scheduler/permissions";

export async function requireSession(): Promise<SchedulerSessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export function requirePermission(
  user: SchedulerSessionUser,
  key: PermissionKey,
): true | NextResponse {
  if (!userHasPermission(user, key)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return true;
}
