import { SignJWT, jwtVerify } from "jose";
import type { AppModuleKey } from "./path-access";
import { SITE_SESSION_MAX_AGE_DAYS } from "./constants";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.APP_AUTH_SECRET ?? "development-only-change-app-auth-secret",
  );
}

export type SiteJwtPayload = {
  sub: string;
  /** 1 = site admin */
  adm: 0 | 1;
  /** Login username */
  un: string;
  /** Display name */
  nm: string;
  /** Granted modules (subset of AppModule); admins may have full list in token */
  mod: AppModuleKey[];
};

export async function signSiteToken(payload: SiteJwtPayload): Promise<string> {
  return new SignJWT({
    adm: payload.adm,
    un: payload.un,
    nm: payload.nm,
    mod: payload.mod,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SITE_SESSION_MAX_AGE_DAYS}d`)
    .sign(getSecret());
}

export async function verifySiteToken(token: string): Promise<SiteJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    const adm = payload.adm === 1 ? 1 : 0;
    const un = typeof payload.un === "string" ? payload.un : "";
    const nm = typeof payload.nm === "string" ? payload.nm : "";
    const modRaw = payload.mod;
    const mod = Array.isArray(modRaw)
      ? (modRaw.filter((m) => typeof m === "string") as AppModuleKey[])
      : [];
    return { sub, adm, un, nm, mod };
  } catch {
    return null;
  }
}
