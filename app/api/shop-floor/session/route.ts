import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  SHOP_FLOOR_SESSION_COOKIE,
  createShopFloorToken,
  getShopFloorSessionEmployee,
} from "@/lib/shop-floor/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const emp = await getShopFloorSessionEmployee();
  if (!emp) return NextResponse.json({ employee: null });
  return NextResponse.json({ employee: emp });
}

export async function POST(request: Request) {
  let body: { employeeId?: string; pin?: string };
  try {
    body = (await request.json()) as { employeeId?: string; pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const employeeId = String(body.employeeId ?? "").trim();
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }
  const emp = await prisma.shopFloorEmployee.findFirst({
    where: { id: employeeId, active: true },
  });
  if (!emp) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (emp.pinHash) {
    const pin = String(body.pin ?? "");
    const ok = await bcrypt.compare(pin, emp.pinHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }
  }

  const token = await createShopFloorToken(emp.id);
  const res = NextResponse.json({ employee: { id: emp.id, name: emp.name } });
  res.cookies.set(SHOP_FLOOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SHOP_FLOOR_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
