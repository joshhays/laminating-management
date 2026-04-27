import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ALL_APP_MODULES } from "@/lib/auth/module-keys";
import type { AppModuleKey } from "@/lib/auth/path-access";
import { createSessionTokenForUser, setSiteSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const usernameRaw = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!usernameRaw || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const usernameKey = usernameRaw.toLowerCase();
  const userResolved = await prisma.siteUser.findUnique({
    where: { username: usernameKey },
    include: { moduleGrants: true },
  });

  if (!userResolved) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, userResolved.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const modules: AppModuleKey[] = userResolved.isAdmin
    ? (ALL_APP_MODULES as AppModuleKey[])
    : userResolved.moduleGrants.map((g) => g.module as AppModuleKey);

  const token = await createSessionTokenForUser({
    userId: userResolved.id,
    username: userResolved.username,
    displayName: userResolved.displayName ?? userResolved.username,
    isAdmin: userResolved.isAdmin,
    modules,
  });

  await setSiteSessionCookie(token);

  return NextResponse.json({
    ok: true,
    user: {
      id: userResolved.id,
      username: userResolved.username,
      displayName: userResolved.displayName,
      isAdmin: userResolved.isAdmin,
      modules,
    },
  });
}
