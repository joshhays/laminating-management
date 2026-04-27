import bcrypt from "bcryptjs";
import { AppModule } from "@prisma/client";
import { NextResponse } from "next/server";
import { ALL_APP_MODULES } from "@/lib/auth/module-keys";
import { requireSiteAdmin } from "@/lib/auth/require-site";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireSiteAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: {
    displayName?: string | null;
    password?: string;
    isAdmin?: boolean;
    modules?: AppModule[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = await prisma.siteUser.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.isAdmin !== undefined && !auth.isAdmin) {
    return NextResponse.json(
      { error: "Only site admins can change the admin flag" },
      { status: 403 },
    );
  }

  const passwordHash =
    body.password != null && String(body.password).length > 0
      ? await bcrypt.hash(String(body.password), 12)
      : null;

  const modulesFiltered =
    Array.isArray(body.modules) && body.modules.length > 0
      ? (body.modules.filter((m) => ALL_APP_MODULES.includes(m)) as AppModule[])
      : [];

  const nextIsAdmin =
    body.isAdmin !== undefined && auth.isAdmin ? Boolean(body.isAdmin) : target.isAdmin;

  if (body.isAdmin === false && auth.isAdmin && modulesFiltered.length === 0) {
    return NextResponse.json(
      { error: "Select at least one module when removing admin access" },
      { status: 400 },
    );
  }

  if (body.modules !== undefined && !nextIsAdmin && modulesFiltered.length === 0) {
    return NextResponse.json({ error: "Select at least one module" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.siteUser.update({
      where: { id },
      data: {
        ...(body.displayName !== undefined
          ? { displayName: body.displayName === "" ? null : body.displayName }
          : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(body.isAdmin !== undefined && auth.isAdmin ? { isAdmin: nextIsAdmin } : {}),
      },
    });

    if (nextIsAdmin) {
      await tx.siteUserModuleGrant.deleteMany({ where: { userId: id } });
      await tx.siteUserModuleGrant.createMany({
        data: ALL_APP_MODULES.map((m) => ({ userId: id, module: m })),
      });
    } else if (body.modules !== undefined) {
      await tx.siteUserModuleGrant.deleteMany({ where: { userId: id } });
      await tx.siteUserModuleGrant.createMany({
        data: modulesFiltered.map((m) => ({ userId: id, module: m })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
