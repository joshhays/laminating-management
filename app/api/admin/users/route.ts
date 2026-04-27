import bcrypt from "bcryptjs";
import { AppModule } from "@prisma/client";
import { NextResponse } from "next/server";
import { ALL_APP_MODULES } from "@/lib/auth/module-keys";
import { requireSiteAdmin } from "@/lib/auth/require-site";
import { normalizeSiteUsername } from "@/lib/auth/usernames";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireSiteAdmin();
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.siteUser.findMany({
    orderBy: { username: "asc" },
    include: { moduleGrants: true },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      isAdmin: u.isAdmin,
      modules: u.isAdmin ? ALL_APP_MODULES : u.moduleGrants.map((g) => g.module),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireSiteAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: {
    username?: string;
    password?: string;
    displayName?: string;
    isAdmin?: boolean;
    modules?: AppModule[];
  };
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

  const wantsAdmin = Boolean(body.isAdmin);
  const isAdmin = wantsAdmin && auth.isAdmin;
  const modulesInput = Array.isArray(body.modules) ? body.modules : [];
  const modulesFiltered = modulesInput.filter((m) =>
    ALL_APP_MODULES.includes(m),
  ) as AppModule[];

  if (!isAdmin && modulesFiltered.length === 0) {
    return NextResponse.json(
      { error: "Select at least one module, or create a site admin (site admins only)" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.siteUser.create({
    data: {
      username,
      displayName,
      passwordHash,
      isAdmin,
      moduleGrants: isAdmin
        ? { create: ALL_APP_MODULES.map((m) => ({ module: m })) }
        : { create: modulesFiltered.map((m) => ({ module: m })) },
    },
  });

  return NextResponse.json({ ok: true, id: user.id });
}
