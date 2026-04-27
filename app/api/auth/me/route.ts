import { NextResponse } from "next/server";
import { getSiteSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const count = await prisma.siteUser.count();
  const session = await getSiteSession();
  return NextResponse.json({
    needsBootstrap: count === 0,
    user: session
      ? {
          userId: session.userId,
          username: session.username,
          displayName: session.displayName,
          isAdmin: session.isAdmin,
          modules: session.modules,
        }
      : null,
  });
}
