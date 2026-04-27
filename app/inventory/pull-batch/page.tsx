import Link from "next/link";
import { PullBatchClient } from "./pull-batch-client";

export default function InventoryPullBatchPage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/inventory"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Film inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          End-of-day film pull
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Review every pending allocation, adjust pull amounts if needed, approve variances against the
          estimate snapshot, then pull from floor stock in one batch.
        </p>
      </header>
      <PullBatchClient />
    </div>
  );
}
