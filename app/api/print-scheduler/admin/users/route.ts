import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/print-scheduler/auth";
import { requireUserManage } from "@/lib/print-scheduler/admin-guard";
import { prisma } from "@/lib/prisma";
import { ROLES, permissionsForRole, toPublicUser } from "@/lib/print-scheduler/permissions";
import type { PermissionKey } from "@/lib/print-scheduler/permissions";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireUserManage();
  if (guard instanceof NextResponse) return guard;

  try {
    const users = await prisma.schedulerUser.findMany({
      orderBy: { username: "asc" },
      include: { machine: { select: { id: true, slug: true, name: true } } },
    });
    return NextResponse.json({ users: users.map(toPublicUser) });
  } catch (e) {
    console.error("[GET /api/admin/users]", e);
    return NextResponse.json({ error: "Could not load users." }, { status: 503 });
  }
}

function isRole(s: string): s is (typeof ROLES)[number] {
  return (ROLES as readonly string[]).includes(s);
}

export async function POST(request: Request) {
  const guard = await requireUserManage();
  if (guard instanceof NextResponse) return guard;

  let body: {
    username?: string;
    displayName?: string;
    password?: string;
    role?: string;
    machineId?: string | null;
  } & Partial<Record<PermissionKey, boolean>>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = String(body.username ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(body.displayName ?? "").trim();
  const password = String(body.password ?? "");
  const roleRaw = String(body.role ?? "VIEWER").trim().toUpperCase();
  const role = isRole(roleRaw) ? roleRaw : "VIEWER";

  if (!username || !displayName || !password) {
    return NextResponse.json(
      { error: "username, displayName, and password are required." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const preset = permissionsForRole(role);
  const flags: Record<PermissionKey, boolean> = { ...preset };
  const keys: PermissionKey[] = [
    "canViewSchedule",
    "canEditSchedule",
    "canImportJobs",
    "canManageMachines",
    "canViewCompletedTab",
    "canViewCancelledTab",
    "canManageUsers",
  ];
  for (const k of keys) {
    if (typeof body[k] === "boolean") flags[k] = body[k]!;
  }

  let machineId: string | null = null;
  if (role === "MACHINE") {
    const mid = typeof body.machineId === "string" ? body.machineId.trim() : "";
    if (!mid) {
      return NextResponse.json(
        { error: "MACHINE role requires selecting a machine." },
        { status: 400 },
      );
    }
    const m = await prisma.printPressMachine.findUnique({ where: { id: mid } });
    if (!m) {
      return NextResponse.json({ error: "Unknown machine." }, { status: 400 });
    }
    machineId = m.id;
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.schedulerUser.create({
      data: {
        username,
        displayName,
        passwordHash,
        role,
        machineId,
        ...flags,
      },
      include: { machine: { select: { id: true, slug: true, name: true } } },
    });
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create user.";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "A user with this username already exists." }, { status: 409 });
    }
    console.error("[POST /api/admin/users]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
