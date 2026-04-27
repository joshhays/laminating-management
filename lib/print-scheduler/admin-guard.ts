import { NextResponse } from "next/server";
import {
  getSessionUser,
  isSchedulerAuthEnabled,
  type SchedulerSessionUser,
} from "@/lib/print-scheduler/auth";
import { userHasPermission } from "@/lib/print-scheduler/permissions";

export async function requireUserManage(): Promise<SchedulerSessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchedulerAuthEnabled()) {
    return user;
  }
  if (!userHasPermission(user, "canManageUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}
