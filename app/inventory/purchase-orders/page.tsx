import Link from "next/link";
import { prisma } from "@/lib/prisma";

function statusLabel(s: string) {
  switch (s) {
    case "DRAFT":
      return "Draft";
    case "ORDERED":
      return "Ordered";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
    default:
      return s;
  }
}

export default async function PurchaseOrdersPage() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { lines: true },
  });

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/inventory"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            ← Film inventory
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Purchase orders</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Create POs, mark ordered, receive into new film rolls.
          </p>
        </div>
        <Link
          href="/inventory/purchase-orders/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New purchase order
        </Link>
      </header>

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-600">No purchase orders yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {orders.map((po) => (
            <li key={po.id}>
              <Link
                href={`/inventory/purchase-orders/${po.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-zinc-50"
              >
                <div>
                  <p className="font-mono text-sm font-medium text-zinc-900">{po.id}</p>
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {po.supplierName ?? "No supplier"} · {po.lines.length} line
                    {po.lines.length === 1 ? "" : "s"}
                    {po.reference ? ` · Ref ${po.reference}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
                  {statusLabel(po.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
