import Link from "next/link";
import { PurchaseOrderStatus } from "@prisma/client";
import { getFilmRollUsageDetail } from "@/lib/film-inventory-rollup";
import { prisma } from "@/lib/prisma";

function poStatusLabel(s: PurchaseOrderStatus) {
  switch (s) {
    case "DRAFT":
      return "Draft";
    case "ORDERED":
      return "Ordered";
    case "PARTIALLY_RECEIVED":
      return "Partial";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
    default:
      return s;
  }
}

export async function FilmRollUsage({ filmInventoryId }: { filmInventoryId: string }) {
  const u = await getFilmRollUsageDetail(prisma, filmInventoryId);
  if (!u) return null;

  return (
    <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-zinc-900">Usage &amp; demand</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Rollups from live quotes, job allocations, and open purchase orders (draft / ordered / partial).
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">In estimates</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{u.inEstimateCount}</dd>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">On order (open qty)</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
            {u.onOrderOpenLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Allocated to jobs</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
            {u.allocatedToJobLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Available (unreserved)</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
            {u.availableLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft
          </dd>
        </div>
      </dl>

      {u.purchaseOrders.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-zinc-900">Purchase orders</h3>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
            {u.purchaseOrders.map((p) => (
              <li key={p.lineId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <Link
                    href={`/inventory/purchase-orders/${p.purchaseOrderId}`}
                    className="font-medium text-zinc-900 underline hover:no-underline"
                  >
                    {p.reference?.trim() || p.purchaseOrderId.slice(0, 8) + "…"}
                  </Link>
                  <span className="text-zinc-500">
                    {" "}
                    · {p.supplierName ?? "No supplier"} · {poStatusLabel(p.status)}
                  </span>
                </div>
                <span className="tabular-nums text-zinc-700">
                  Open {p.openLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })} lin ft
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {u.estimates.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-zinc-900">Estimates</h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {u.estimates.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/estimates/${e.id}`}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-medium text-zinc-800 hover:bg-zinc-100"
                >
                  {e.estimateNumber != null ? `Quote #${e.estimateNumber}` : e.id.slice(0, 8) + "…"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {u.jobs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-zinc-900">Jobs</h3>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
            {u.jobs.map((j) => (
              <li key={j.allocationId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <Link
                  href={`/jobs/${j.jobTicketId}`}
                  className="font-medium text-zinc-900 underline hover:no-underline"
                >
                  {j.jobNumber != null ? `Job #${j.jobNumber}` : j.jobTicketId.slice(0, 8) + "…"}
                </Link>
                <span className="text-zinc-600">
                  Pass {j.passOrder} · {j.allocatedLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  ft · {j.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
