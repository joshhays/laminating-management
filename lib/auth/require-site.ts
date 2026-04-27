import { NextResponse } from "next/server";
import { getSiteSession, type SiteSession } from "./session";

export async function requireSiteSession(): Promise<SiteSession | NextResponse> {
  const s = await getSiteSession();
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return s;
}

/** User management: site admin flag or ADMIN module grant. */
export async function requireSiteAdmin(): Promise<SiteSession | NextResponse> {
  const s = await requireSiteSession();
  if (s instanceof NextResponse) return s;
  if (s.isAdmin || s.modules.includes("ADMIN")) {
    return s;
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
