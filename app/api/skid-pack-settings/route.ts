import { NextResponse } from "next/server";
import {
  DEFAULT_MAX_SKID_WEIGHT_LBS,
  DEFAULT_MAX_STACK_HEIGHT_INCHES,
} from "@/lib/skid-pack-estimate";
import { prisma } from "@/lib/prisma";

const GLOBAL_ID = "global";

export async function GET() {
  const row = await prisma.skidPackSettings.upsert({
    where: { id: GLOBAL_ID },
    create: {
      id: GLOBAL_ID,
      pricePerSkidUsd: 0,
      maxStackHeightInches: DEFAULT_MAX_STACK_HEIGHT_INCHES,
      maxSkidWeightLbs: DEFAULT_MAX_SKID_WEIGHT_LBS,
    },
    update: {},
  });
  return NextResponse.json(row);
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const n = Number(body.pricePerSkidUsd);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Price per skid must be ≥ 0" }, { status: 400 });
    }
    const h =
      body.maxStackHeightInches !== undefined ? Number(body.maxStackHeightInches) : NaN;
    const w = body.maxSkidWeightLbs !== undefined ? Number(body.maxSkidWeightLbs) : NaN;
    if (!Number.isFinite(h) || h <= 0) {
      return NextResponse.json(
        { error: "Max stack height (inches) must be a positive number" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(w) || w <= 0) {
      return NextResponse.json(
        { error: "Max skid weight (lb) must be a positive number" },
        { status: 400 },
      );
    }
    const row = await prisma.skidPackSettings.upsert({
      where: { id: GLOBAL_ID },
      create: {
        id: GLOBAL_ID,
        pricePerSkidUsd: n,
        maxStackHeightInches: h,
        maxSkidWeightLbs: w,
      },
      update: {
        pricePerSkidUsd: n,
        maxStackHeightInches: h,
        maxSkidWeightLbs: w,
      },
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
