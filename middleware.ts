import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SiteJwtPayload } from "@/lib/auth/jwt";
import { SITE_SESSION_COOKIE } from "@/lib/auth/constants";
import { canAccessModule, requiredModuleForPath } from "@/lib/auth/path-access";

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const required = requiredModuleForPath(pathname);
    if (required === null) {
      return NextResponse.next();
    }

    const token = request.cookies.get(SITE_SESSION_COOKIE)?.value;
    let payload: SiteJwtPayload | null = null;
    if (token) {
      try {
        const { verifySiteToken } = await import("@/lib/auth/jwt");
        payload = await verifySiteToken(token);
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      return NextResponse.next();
    }

    const session = {
      isAdmin: payload.adm === 1,
      modules: payload.mod,
    };

    if (!canAccessModule({ ...session, required })) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }

    return NextResponse.next();
  } catch (e) {
    console.error("[middleware]", e);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
