import { ArrowUpRight, CalendarDays, Layers } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Schedule — Yorke Flow",
  description: "Digital print and laminating production schedules",
};

export default function ScheduleHubPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Schedule</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Production boards
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-600">
          Choose digital press planning or laminating line scheduling.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/schedule/digital-print"
          className="group flex flex-col rounded-3xl border border-white/80 bg-white/90 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-sm transition hover:border-[var(--dashboard-accent)]/30 hover:shadow-lg"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--dashboard-accent)]/10 text-[var(--dashboard-accent)]">
            <CalendarDays className="size-7" strokeWidth={1.75} />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-zinc-900">Digital print</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Pace tickets, press resources, week grid, and operator board for digital work.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--dashboard-accent)]">
            Open board
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/schedule/laminating"
          className="group flex flex-col rounded-3xl border border-white/80 bg-white/90 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-sm transition hover:border-[var(--dashboard-accent)]/30 hover:shadow-lg"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <Layers className="size-7" strokeWidth={1.75} />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-zinc-900">Laminating</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Laminator queue, job tickets, and estimates tied to film and machine time.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
            Open laminating schedule
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
