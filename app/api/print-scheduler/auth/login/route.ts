import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  isSchedulerAuthEnabled,
  verifyPassword,
} from "@/lib/print-scheduler/auth";
import { toPublicUser } from "@/lib/print-scheduler/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSchedulerAuthEnabled()) {
    return NextResponse.json(
      { error: "Scheduler login is disabled. Open /schedule/digital-print directly." },
      { status: 400 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = String(body.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  try {
    const user = await prisma.schedulerUser.findUnique({
      where: { username },
      include: { machine: { select: { id: true, slug: true, name: true } } },
    });
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({ user: toPublicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    console.error("[POST /api/auth/login]", e);
    const detail =
      process.env.NODE_ENV !== "production" && e instanceof Error ? e.message : null;
    return NextResponse.json(
      {
        error: "Login failed",
        hint:
          detail ??
          "Check the terminal running Next.js. If the database is empty, run: npx prisma db seed",
      },
      { status: 503 },
    );
  }
}
