import Link from "next/link";
import { Package, ShoppingCart } from "lucide-react";

export default function PurchasingPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <header className="mb-10">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
          ← Home
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShoppingCart className="size-8 text-[var(--dashboard-accent)]" strokeWidth={1.75} />
          Purchasing
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Create purchase orders, send requests to vendors, and receive film into inventory.
        </p>
      </header>

      <ul className="space-y-4">
        <li>
          <Link
            href="/inventory/purchase-orders"
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300"
          >
            <ShoppingCart className="size-6 text-zinc-600" />
            <div>
              <p className="font-medium text-zinc-900">Purchase orders</p>
              <p className="text-sm text-zinc-600">Draft, order, send, receive. Merge lines by vendor.</p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/inventory"
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300"
          >
            <Package className="size-6 text-zinc-600" />
            <div>
              <p className="font-medium text-zinc-900">Film inventory</p>
              <p className="text-sm text-zinc-600">
                See estimates, jobs, on-order quantity, and available feet per roll.
              </p>
            </div>
          </Link>
        </li>
      </ul>
    </div>
  );
}
