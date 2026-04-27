import Link from "next/link";
import { ClipboardList, SlidersHorizontal, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ModuleSetupPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
        Home
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">Module setup</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Configure how each module runs: estimating defaults, equipment families, and rate drivers.
      </p>

      <ul className="mt-8 space-y-3">
        <li>
          <Link
            href="/module-setup/estimating"
            className="flex items-start gap-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--dashboard-accent)]/12 text-[var(--dashboard-accent)]">
              <ClipboardList className="size-5" strokeWidth={2} />
            </span>
            <span>
              <span className="font-medium text-zinc-900">Estimating setup</span>
              <span className="mt-0.5 block text-sm text-zinc-600">
                Press, laminating, finishing, and mailing equipment used when building quotes.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/module-setup/shipping"
            className="flex items-start gap-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--dashboard-accent)]/12 text-[var(--dashboard-accent)]">
              <Truck className="size-5" strokeWidth={2} />
            </span>
            <span>
              <span className="font-medium text-zinc-900">Shipping &amp; skid pack</span>
              <span className="mt-0.5 block text-sm text-zinc-600">
                Max stack height &amp; weight, outbound skid rate — drives skid counts on estimates.
              </span>
            </span>
          </Link>
        </li>
        <li className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-5 text-sm text-zinc-500">
          <SlidersHorizontal className="-mt-0.5 mr-2 inline size-4 opacity-60" strokeWidth={2} />
          More modules (inventory rules, scheduling defaults, etc.) can land here later.
        </li>
      </ul>
    </div>
  );
}
