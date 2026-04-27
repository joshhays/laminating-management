import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/print-scheduler/auth";
import { requireUserManage } from "@/lib/print-scheduler/admin-guard";
import { prisma } from "@/lib/prisma";
import { ROLES, permissionsForRole, toPublicUser } from "@/lib/print-scheduler/permissions";
import type { PermissionKey } from "@/lib/print-scheduler/permissions";

export const runtime = "nodejs";

function isRole(s: string): s is (typeof ROLES)[number] {
  return (ROLES as readonly string[]).includes(s);
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireUserManage();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  let body: {
    displayName?: string;
    role?: string;
    password?: string;
    machineId?: string | null;
  } & Partial<Record<PermissionKey, boolean>>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.schedulerUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const data: Prisma.SchedulerUserUncheckedUpdateInput = {};

  if (typeof body.displayName === "string") {
    const dn = body.displayName.trim();
    if (dn) data.displayName = dn;
  }

  if (typeof body.role === "string") {
    const roleRaw = body.role.trim().toUpperCase();
    const role = isRole(roleRaw) ? roleRaw : existing.role;
    data.role = role;
    const preset = permissionsForRole(role);
    data.canViewSchedule = preset.canViewSchedule;
    data.canEditSchedule = preset.canEditSchedule;
    data.canImportJobs = preset.canImportJobs;
    data.canManageMachines = preset.canManageMachines;
    data.canViewCompletedTab = preset.canViewCompletedTab;
    data.canViewCancelledTab = preset.canViewCancelledTab;
    data.canManageUsers = preset.canManageUsers;
    if (role !== "MACHINE") {
      data.machineId = null;
    }
  }

  if (body.machineId !== undefined) {
    if (body.machineId === null || body.machineId === "") {
      data.machineId = null;
    } else {
      const m = await prisma.printPressMachine.findUnique({ where: { id: String(body.machineId).trim() } });
      if (!m) {
        return NextResponse.json({ error: "Unknown machine." }, { status: 400 });
      }
      data.machineId = m.id;
    }
  }

  const flagKeys: PermissionKey[] = [
    "canViewSchedule",
    "canEditSchedule",
    "canImportJobs",
    "canManageMachines",
    "canViewCompletedTab",
    "canViewCancelledTab",
    "canManageUsers",
  ];
  for (const k of flagKeys) {
    if (typeof body[k] === "boolean") {
      data[k] = body[k]!;
    }
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    data.passwordHash = await hashPassword(body.password);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const finalRole =
    typeof data.role === "string" ? (data.role as string) : existing.role;
  const finalMachineId =
    data.machineId !== undefined ? (data.machineId as string | null) : existing.machineId;
  if (finalRole === "MACHINE" && !finalMachineId) {
    return NextResponse.json(
      { error: "MACHINE role requires selecting a machine." },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.schedulerUser.update({
      where: { id },
      data,
      include: { machine: { select: { id: true, slug: true, name: true } } },
    });
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (e) {
    console.error("[PATCH /api/admin/users/[id]]", e);
    return NextResponse.json({ error: "Could not update user." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireUserManage();
  if (admin instanceof NextResponse) return admin;

  const { id } = await ctx.params;
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  try {
    await prisma.schedulerUser.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
}
