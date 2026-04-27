import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MAX_SKID_WEIGHT_LBS,
  DEFAULT_MAX_STACK_HEIGHT_INCHES,
} from "@/lib/skid-pack-estimate";
import { ShippingSettingsClient } from "./shipping-settings-client";

export const dynamic = "force-dynamic";

const GLOBAL_ID = "global";

export default async function ShippingSetupPage() {
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

  const maxH =
    Number.isFinite(row.maxStackHeightInches) && row.maxStackHeightInches > 0
      ? row.maxStackHeightInches
      : DEFAULT_MAX_STACK_HEIGHT_INCHES;
  const maxLb =
    Number.isFinite(row.maxSkidWeightLbs) && row.maxSkidWeightLbs > 0
      ? row.maxSkidWeightLbs
      : DEFAULT_MAX_SKID_WEIGHT_LBS;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-6 py-10">
      <nav className="text-sm text-zinc-500">
        <Link href="/module-setup" className="font-medium hover:text-zinc-800">
          Module setup
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-800">Shipping</span>
      </nav>
      <header className="mb-8 mt-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Shipping &amp; skid pack</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Stack height and weight limits for skid counts on estimates, plus per-outbound-skid pricing.
        </p>
      </header>
      <ShippingSettingsClient
        initialPricePerSkidUsd={row.pricePerSkidUsd}
        initialMaxStackHeightInches={maxH}
        initialMaxSkidWeightLbs={maxLb}
      />
    </div>
  );
}
