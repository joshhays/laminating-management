import Link from "next/link";
import { PurchaseOrderNewClient } from "./purchase-order-new-client";

type PageProps = { searchParams: Promise<{ filmId?: string; feet?: string }> };

export default async function NewPurchaseOrderPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/inventory/purchase-orders"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Purchase orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New purchase order</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Saves as draft. Mark ordered when sent to the supplier, then receive to create rolls. Lines can be
          linked to a film SKU so receipts add feet to that roll.
        </p>
      </header>
      <PurchaseOrderNewClient prefillFilmId={sp.filmId} prefillFeet={sp.feet} />
    </div>
  );
}
