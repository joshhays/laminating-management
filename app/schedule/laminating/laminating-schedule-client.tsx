"use client";

import { WeekGridCalendar } from "@/components/print-scheduler/schedule/week-grid-calendar";
import type { MachineResource } from "@/components/print-scheduler/schedule/resource-stack-calendar";
import { Button, buttonVariants } from "@/components/print-scheduler/ui/button";
import { cn } from "@/lib/cn";
import {
  laminatingJobsToCalendarEvents,
  type LaminatingJobCalendarApiRow,
} from "@/lib/laminating-schedule/calendar-mapper";
import {
  laminatingRunMinutesFromEstimate,
  nextQuarterHourAfter,
} from "@/lib/laminating-schedule/schedule-times";
import type { CalendarEventBlock } from "@/types/calendar";
import { ArrowUpRight, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type LaminatingSchedulePayload = {
  machines: { id: string; name: string }[];
  scheduled: LaminatingJobCalendarApiRow[];
  unscheduled: LaminatingJobCalendarApiRow[];
  weekStart: string;
};

const UNASSIGNED_ID = "__unassigned__";

export function LaminatingScheduleClient() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<LaminatingSchedulePayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const weekStartMonday = useMemo(() => {
    const a = new Date();
    a.setDate(a.getDate() + weekOffset * 7);
    a.setHours(12, 0, 0, 0);
    const day = a.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const x = new Date(a);
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }, [weekOffset]);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const q = new URLSearchParams({ weekStart: weekStartMonday.toISOString() });
      const res = await fetch(`/api/laminating-schedule?${q}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Load failed (${res.status})`);
      }
      setData((await res.json()) as LaminatingSchedulePayload);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load schedule");
    }
  }, [weekStartMonday]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const resources: MachineResource[] = useMemo(() => {
    const base: MachineResource[] = [{ id: UNASSIGNED_ID, title: "Unassigned" }];
    if (!data) return base;
    return [...base, ...data.machines.map((m) => ({ id: m.id, title: m.name }))];
  }, [data]);

  const events: CalendarEventBlock[] = useMemo(() => {
    if (!data) return [];
    return laminatingJobsToCalendarEvents(data.scheduled);
  }, [data]);

  async function onEventDrop(payload: {
    jobId: string;
    startTime: string;
    endTime: string;
    resourceId: string | null;
    recalculateEndFromPressSpeed?: boolean;
  }): Promise<void> {
    void payload.recalculateEndFromPressSpeed;
    const body: Record<string, string | null> = {
      scheduledStart: payload.startTime,
      scheduledEnd: payload.endTime,
    };
    if (payload.resourceId === UNASSIGNED_ID) {
      body.machineId = null;
    } else if (payload.resourceId) {
      body.machineId = payload.resourceId;
    }
    const res = await fetch(`/api/job-tickets/${payload.jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast({ type: "err", text: j.error ?? "Could not update schedule" });
      return;
    }
    setToast({ type: "ok", text: "Schedule updated." });
    await load();
  }

  async function autoPlaceJob(job: LaminatingJobCalendarApiRow) {
    const runMin = laminatingRunMinutesFromEstimate(job.estimate?.estimatedRunTimeMinutes);
    const start = nextQuarterHourAfter(new Date());
    const end = new Date(start.getTime() + runMin * 60_000);
    const machineId = job.machineId ?? job.estimate?.machineId ?? null;
    const res = await fetch(`/api/job-tickets/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        ...(machineId ? { machineId } : {}),
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast({ type: "err", text: j.error ?? "Could not place job" });
      return;
    }
    setToast({ type: "ok", text: "Placed on calendar." });
    await load();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/80 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200/80 pb-6 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
              Schedule
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Laminating
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Week grid for job tickets created from estimates. Drag blocks to move or reassign lines;
              times default from estimate run minutes when you convert a quote.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/schedule"
              className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}
            >
              <Layers className="size-4" />
              Schedule home
            </Link>
            <Link
              href="/estimates"
              className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}
            >
              Estimates
              <ArrowUpRight className="size-4" />
            </Link>
            <Button type="button" variant="secondary" onClick={() => void load()} disabled={!data}>
              Refresh
            </Button>
          </div>
        </header>

        {loadErr ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {loadErr}
          </p>
        ) : null}

        {toast ? (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              toast.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
            )}
          >
            {toast.text}
          </p>
        ) : null}

        {data && data.unscheduled.length > 0 ? (
          <section className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/25">
            <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              Needs a time ({data.unscheduled.length})
            </h2>
            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
              These jobs have no calendar window yet. Place one using estimate run length and the quote’s
              laminator (if set).
            </p>
            <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {data.unscheduled.map((j) => (
                <li
                  key={j.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/90 bg-white/90 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-zinc-900/60"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {j.estimate?.estimateNumber != null
                      ? `Quote #${j.estimate.estimateNumber}`
                      : `Job ${j.id.slice(0, 8)}…`}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => void autoPlaceJob(j)}
                  >
                    Place next slot
                  </Button>
                  <Link
                    href={`/jobs/${j.id}`}
                    className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                  >
                    Open job
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data ? (
          <WeekGridCalendar
            resources={resources}
            events={events}
            onEventDrop={(p) => onEventDrop(p)}
            onEventClick={(id) => router.push(`/jobs/${id}`)}
            operatorActiveByJobId={{}}
            operatorName={null}
            realtimeEnabled={false}
            onOperatorToggle={() => {}}
            machineColumnTitle="Line"
            showOperatorControlsOnCards={false}
            weekOffset={weekOffset}
            onWeekOffsetChange={(n) => setWeekOffset(n)}
          />
        ) : (
          !loadErr && (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
              Loading schedule…
            </div>
          )
        )}

      </div>
    </div>
  );
}
