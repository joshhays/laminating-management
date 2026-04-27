import { JobStatus } from "@prisma/client";
import {
  ArrowUpRight,
  ClipboardList,
  Film,
  Layers,
  Printer,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { DashboardCard } from "@/components/app-chrome/dashboard-card";
import { PrintSchedulerLink } from "@/components/print-scheduler-link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const quickLinks = [
  {
    href: "/estimate/new",
    title: "New estimate",
    desc: "Price a job with film, machine time, and trim.",
    icon: Layers,
    accent: true,
  },
  {
    href: "/estimates",
    title: "All estimates",
    desc: "Review quotes and convert to jobs.",
    icon: ClipboardList,
  },
  {
    href: "/inventory",
    title: "Film inventory",
    desc: "Rolls, MSI pricing, and stock levels.",
    icon: Film,
  },
  {
    href: "/module-setup",
    title: "Module setup",
    desc: "Estimating equipment: press, laminating, finishing, mailing.",
    icon: Warehouse,
  },
] as const;

export default async function Home() {
  const [rollCount, estimateCount, machineCount, activeJobs, scheduleJobs] =
    await Promise.all([
      prisma.filmInventory.count(),
      prisma.estimate.count(),
      prisma.machine.count({ where: { active: true } }),
      prisma.jobTicket.count({
        where: { status: { in: [JobStatus.QUEUED, JobStatus.IN_PROGRESS] } },
      }),
      prisma.printScheduleJob.count(),
    ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section>
        <h2 className="sr-only">Key metrics</h2>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Film rolls in stock"
            value={rollCount}
            hint="Active SKUs in inventory"
            icon={Film}
          />
          <DashboardCard
            title="Estimates on file"
            value={estimateCount}
            hint="Saved quotes"
            icon={ClipboardList}
          />
          <DashboardCard
            title="Active machines"
            value={machineCount}
            hint="Laminators & cutters"
            icon={Warehouse}
          />
          <DashboardCard
            title="Jobs in production"
            value={activeJobs}
            hint="Queued or in progress"
            icon={Layers}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-sm sm:p-8 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Quick actions</h2>
              <p className="mt-1 text-sm text-zinc-500">Jump to the most common workflows.</p>
            </div>
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const { href, title, desc, icon: Icon } = item;
              const accent = "accent" in item && item.accent === true;
              return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border p-5 transition-all",
                    accent
                      ? "border-[var(--dashboard-accent)]/25 bg-[var(--dashboard-accent)]/5 shadow-sm hover:border-[var(--dashboard-accent)]/40 hover:shadow-md"
                      : "border-zinc-200/80 bg-white/70 hover:border-zinc-300 hover:shadow-md",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl",
                        accent
                          ? "bg-[var(--dashboard-accent)] text-white"
                          : "bg-zinc-100 text-[var(--dashboard-accent)]",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <ArrowUpRight className="size-5 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--dashboard-accent)]" />
                  </div>
                  <h3 className="mt-4 font-semibold text-zinc-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{desc}</p>
                </Link>
              </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Digital print</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Schedule hub: press board and Pace ticket intake.
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--dashboard-accent)]/10 p-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-[var(--dashboard-accent)] text-white">
                <Printer className="size-6" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">
                  {scheduleJobs}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Jobs on calendar
                </p>
              </div>
            </div>
            <PrintSchedulerLink
              className={cn(
                "mt-4 flex w-full items-center justify-center rounded-2xl bg-[var(--dashboard-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#3F3DBC]/25 transition hover:brightness-110",
              )}
            >
              Open digital print
            </PrintSchedulerLink>
          </div>

          <div className="rounded-3xl border border-dashed border-zinc-200/90 bg-white/60 p-6 backdrop-blur-sm">
            <h3 className="font-semibold text-zinc-900">Purchase orders</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Incoming film and receiving workflow.
            </p>
            <Link
              href="/inventory/purchase-orders"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--dashboard-accent)] hover:underline"
            >
              View orders
              <ArrowUpRight className="size-4" />
            </Link>
          </div>

          <div className="rounded-3xl border border-dashed border-zinc-200/90 bg-white/60 p-6 backdrop-blur-sm">
            <h3 className="font-semibold text-zinc-900">Shipping &amp; skid pack</h3>
            <p className="mt-1 text-sm text-zinc-500">Stack limits and per-outbound skid rate for estimates.</p>
            <Link
              href="/module-setup/shipping"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--dashboard-accent)] hover:underline"
            >
              Configure
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
