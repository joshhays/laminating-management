import Link from "next/link";
import { FilmInventoryClient } from "./film-inventory-client";

export default function InventoryPage() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Film inventory
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Each item can be on-floor stock or catalog-only. Row Edit opens a full form to change pricing,
            dimensions, vendor, or whether the line is catalog vs on-floor.
          </p>
          <nav className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/purchasing" className="font-medium text-zinc-800 underline hover:text-zinc-950">
              Purchasing
            </Link>
            <Link
              href="/inventory/purchase-orders"
              className="font-medium text-zinc-800 underline hover:text-zinc-950"
            >
              Purchase orders
            </Link>
            <Link
              href="/inventory/pull-batch"
              className="font-medium text-zinc-800 underline hover:text-zinc-950"
            >
              End-of-day pull
            </Link>
            <Link
              href="/inventory/stock"
              className="font-medium text-zinc-800 underline hover:text-zinc-950"
            >
              Stock operations
            </Link>
            <Link
              href="/inventory/material-types"
              className="font-medium text-zinc-800 underline hover:text-zinc-950"
            >
              Material types
            </Link>
          </nav>
        </div>
      </header>
      <FilmInventoryClient />
    </div>
  );
}
