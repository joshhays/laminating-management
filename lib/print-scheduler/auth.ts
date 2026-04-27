import type { SchedulerUser as User } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ANONYMOUS_SCHEDULER_USER_ID } from "@/lib/print-scheduler/scheduler-anon";

export const SESSION_COOKIE = "scheduler_session";
const SESSION_DAYS = 7;

export type SchedulerSessionUser = User & {
  machine?: { id: string; slug: string; name: string } | null;
};

/** Set `ENABLE_SCHEDULER_AUTH=true` to require login (cookie session) for the print scheduler. */
export function isSchedulerAuthEnabled(): boolean {
  return process.env.ENABLE_SCHEDULER_AUTH === "true";
}

function buildAnonymousSchedulerUser(): SchedulerSessionUser {
  return {
    id: ANONYMOUS_SCHEDULER_USER_ID,
    username: "guest",
    displayName: "Guest",
    passwordHash: "",
    role: "ADMIN",
    machineId: null,
    canViewSchedule: true,
    canEditSchedule: true,
    canImportJobs: true,
    canManageMachines: true,
    canViewCompletedTab: true,
    canViewCancelledTab: true,
    canManageUsers: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    machine: null,
  };
}

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? "development-only-change-me";
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return { sub };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SchedulerSessionUser | null> {
  if (!isSchedulerAuthEnabled()) {
    return buildAnonymousSchedulerUser();
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload?.sub) return null;
  try {
    const row = await prisma.schedulerUser.findUnique({
      where: { id: payload.sub },
      include: {
        machine: { select: { id: true, slug: true, name: true } },
      },
    });
    return row;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}
