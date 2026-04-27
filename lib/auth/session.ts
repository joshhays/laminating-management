import { cookies } from "next/headers";
import type { AppModuleKey } from "./path-access";
import { SITE_SESSION_COOKIE } from "./constants";
import { signSiteToken, verifySiteToken, type SiteJwtPayload } from "./jwt";

export type SiteSession = {
  userId: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  modules: AppModuleKey[];
};

const SESSION_DAYS = 14;

function sessionFromPayload(p: SiteJwtPayload): SiteSession {
  return {
    userId: p.sub,
    username: p.un,
    displayName: p.nm,
    isAdmin: p.adm === 1,
    modules: p.mod,
  };
}

/** Reads cookie + JWT. Does not hit the database. */
export async function getSiteSession(): Promise<SiteSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SITE_SESSION_COOKIE)?.value;
  if (!token) return null;
  const p = await verifySiteToken(token);
  if (!p) return null;
  return sessionFromPayload(p);
}

export async function setSiteSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(SITE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge,
  });
}

export async function clearSiteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SITE_SESSION_COOKIE);
}

export async function createSessionTokenForUser(input: {
  userId: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  modules: AppModuleKey[];
}): Promise<string> {
  const payload: SiteJwtPayload = {
    sub: input.userId,
    un: input.username,
    adm: input.isAdmin ? 1 : 0,
    nm: input.displayName || input.username,
    mod: input.modules,
  };
  return signSiteToken(payload);
}
