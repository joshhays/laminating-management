import Link from "next/link";
import { Mail, PackageOpen, Printer, Scissors, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/module-setup/estimating/press",
    title: "Press setup",
    desc: "Offset, toner, and inkjet presses — technology-specific specs in types and JSON.",
    icon: Printer,
  },
  {
    href: "/module-setup/estimating/laminating",
    title: "Laminating setup",
    desc: "Laminators: web width, speed rules, spoilage bands (same as your existing line setup).",
    icon: PackageOpen,
  },
  {
    href: "/module-setup/estimating/finishing",
    title: "Finishing machines",
    desc: "Cutters (estimate trim), folders, binders, and other bindery / finishing.",
    icon: Scissors,
  },
  {
    href: "/module-setup/estimating/mailing",
    title: "Mailing setup",
    desc: "Mail prep, inserting, addressing — equipment records for future estimate hooks.",
    icon: Mail,
  },
  {
    href: "/module-setup/shipping",
    title: "Shipping & skid pack",
    desc: "Stack height, max skid weight, and $/outbound skid for lamination quotes.",
    icon: Truck,
  },
] as const;

export default function EstimatingSetupHubPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <nav className="text-sm text-zinc-500">
        <Link href="/module-setup" className="font-medium hover:text-zinc-800">
          Module setup
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-800">Estimating</span>
      </nav>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">Estimating setup</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Equipment families that feed the estimate builder. Edit individual machines on the detail page
        (speed rules, cutter times, technical specs).
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {cards.map(({ href, title, desc, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <Icon className="size-5 text-[var(--dashboard-accent)]" strokeWidth={2} />
              <span className="mt-3 font-medium text-zinc-900">{title}</span>
              <span className="mt-1 flex-1 text-sm text-zinc-600">{desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
