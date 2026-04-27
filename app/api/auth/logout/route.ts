import { NextResponse } from "next/server";
import { clearSiteSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSiteSessionCookie();
  return NextResponse.json({ ok: true });
}
