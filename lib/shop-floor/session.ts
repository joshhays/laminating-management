import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SHOP_FLOOR_SESSION_COOKIE = "shop_floor_employee";

const SESSION_DAYS = 14;

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-only-change-me");
}

export async function createShopFloorToken(employeeId: string): Promise<string> {
  return new SignJWT({ sub: employeeId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifyShopFloorToken(
  token: string,
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    return sub ? { sub } : null;
  } catch {
    return null;
  }
}

export type ShopFloorSessionEmployee = {
  id: string;
  name: string;
};

export async function getShopFloorSessionEmployee(): Promise<ShopFloorSessionEmployee | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SHOP_FLOOR_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyShopFloorToken(token);
  if (!payload?.sub) return null;
  const emp = await prisma.shopFloorEmployee.findFirst({
    where: { id: payload.sub, active: true },
    select: { id: true, name: true },
  });
  return emp;
}
