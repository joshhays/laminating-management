import Link from "next/link";
import { StockOperationsClient } from "./stock-operations-client";

export default function StockOperationsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/inventory"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Film inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Stock operations</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hard counts and manual deductions are recorded as inventory movements.
        </p>
      </header>
      <StockOperationsClient />
    </div>
  );
}
