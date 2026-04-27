import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SITE_SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySiteToken } from "@/lib/auth/jwt";
import { canAccessModule, requiredModuleForPath } from "@/lib/auth/path-access";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const required = requiredModuleForPath(pathname);
  if (required === null) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SITE_SESSION_COOKIE)?.value;
  const payload = token ? await verifySiteToken(token) : null;

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
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
