import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ALL_APP_MODULES } from "@/lib/auth/module-keys";
import type { AppModuleKey } from "@/lib/auth/path-access";
import { normalizeSiteUsername } from "@/lib/auth/usernames";
import { createSessionTokenForUser, setSiteSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * One-time bootstrap when the database has zero site users.
 */
export async function POST(request: Request) {
  const count = await prisma.siteUser.count();
  if (count > 0) {
    return NextResponse.json({ error: "Bootstrap already completed" }, { status: 400 });
  }

  let body: { username?: string; password?: string; displayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = normalizeSiteUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim() || username;

  if (username.length < 2) {
    return NextResponse.json({ error: "Username must be at least 2 characters" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.siteUser.create({
    data: {
      username,
      displayName,
      passwordHash,
      isAdmin: true,
      moduleGrants: {
        create: ALL_APP_MODULES.map((m) => ({ module: m })),
      },
    },
  });

  const modules = ALL_APP_MODULES as AppModuleKey[];
  const token = await createSessionTokenForUser({
    userId: user.id,
    username: user.username,
    displayName: user.displayName ?? user.username,
    isAdmin: true,
    modules,
  });
  await setSiteSessionCookie(token);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isAdmin: true,
      modules,
    },
  });
}
