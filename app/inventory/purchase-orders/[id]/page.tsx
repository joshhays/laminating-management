import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PurchaseOrderDetailClient } from "./purchase-order-detail-client";

type PageProps = { params: Promise<{ id: string }> };

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!po) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/inventory/purchase-orders"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Purchase orders
        </Link>
        <h1 className="mt-2 font-mono text-xl font-semibold tracking-tight text-zinc-900">
          {po.id}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {po.supplierName && <span>Supplier: {po.supplierName} · </span>}
          {po.reference && <span>Ref: {po.reference}</span>}
        </p>
        {po.notes?.trim() && (
          <p className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-800">
            {po.notes}
          </p>
        )}
      </header>
      <PurchaseOrderDetailClient initial={po} />
    </div>
  );
}
