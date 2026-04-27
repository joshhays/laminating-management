"use client";

import { JobIntakeDrawer } from "@/components/print-scheduler/intake/job-intake-drawer";
import { JobDetailDialog } from "@/components/print-scheduler/jobs/job-detail-dialog";
import { JobStatusLists } from "@/components/print-scheduler/jobs/job-status-lists";
import { MachineManagerSheet } from "@/components/print-scheduler/machines/machine-manager-sheet";
import { LaminatingHomeLink } from "@/components/print-scheduler/laminating-home-link";
import { WeekGridCalendar } from "@/components/print-scheduler/schedule/week-grid-calendar";
import { Button, buttonVariants } from "@/components/print-scheduler/ui/button";
import { useScheduleBroadcast } from "@/hooks/use-schedule-broadcast";
import type { JobWithMachine } from "@/lib/print-scheduler/calendar-mapper";
import { jobsToCalendarEvents } from "@/lib/print-scheduler/calendar-mapper";
import type { PublicUser } from "@/lib/print-scheduler/permissions";
import { SCHEDULER_BASE_PATH, schedApi } from "@/lib/print-scheduler/paths";
import { readOkJsonWithAuth } from "@/lib/print-scheduler/response-json";
import { isAnonymousSchedulerSession } from "@/lib/print-scheduler/scheduler-anon";
import { cn } from "@/lib/print-scheduler/utils";
import { Cog, LogOut, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SchedulerMainView = "schedule" | "completed" | "cancelled";

export type MachineRow = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  pressType: string;
  speedSheetsPerHour: number | null;
  speedPagesPerMinute: number | null;
  speedMatrixJson: string | null;
};

type AuthPayload = {
  user: PublicUser;
  effective: Pick<
    PublicUser,
    | "canViewSchedule"
    | "canEditSchedule"
    | "canImportJobs"
    | "canManageMachines"
    | "canViewCompletedTab"
    | "canViewCancelledTab"
    | "canManageUsers"
  >;
};

const REALTIME_CONFIGURED =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;

export function SchedulerClient() {
  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [jobs, setJobs] = useState<JobWithMachine[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [machinesOpen, setMachinesOpen] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [flyJobId, setFlyJobId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mainView, setMainView] = useState<SchedulerMainView>("schedule");
  const [operatorDisplayName, setOperatorDisplayName] = useState<string | null>(null);
  const {
    operatorActiveByJobId,
    setOperatorActiveByJobId,
    broadcastOperatorJob,
  } = useScheduleBroadcast();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(schedApi("auth/me"));
        const data = await readOkJsonWithAuth<AuthPayload>(res);
        setAuth(data);
        setOperatorDisplayName(data.user.displayName);
        try {
          sessionStorage.setItem("scheduler_operator_name", data.user.displayName);
        } catch {
          /* ignore */
        }
      } catch {
        /* 401 → readOkJsonWithAuth redirects */
      }
    })();
  }, []);

  useEffect(() => {
    if (!auth) return;
    if (mainView === "completed" && !auth.effective.canViewCompletedTab) {
      setMainView("schedule");
    }
    if (mainView === "cancelled" && !auth.effective.canViewCancelledTab) {
      setMainView("schedule");
    }
  }, [auth, mainView]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [jr, mr] = await Promise.all([fetch(schedApi("jobs")), fetch(schedApi("machines"))]);
      const [jd, md] = await Promise.all([
        readOkJsonWithAuth<JobWithMachine[]>(jr),
        readOkJsonWithAuth<MachineRow[]>(mr),
      ]);
      setJobs(jd);
      setMachines(md);
      setLoadFailed(false);
    } catch (e) {
      setLoadFailed(true);
      setToast({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load schedule",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth?.effective.canViewSchedule) {
      setLoading(false);
      return;
    }
    void loadAll();
  }, [auth?.effective.canViewSchedule, loadAll]);

  useEffect(() => {
    if (!flyJobId) return;
    const t = window.setTimeout(() => setFlyJobId(null), 2200);
    return () => window.clearTimeout(t);
  }, [flyJobId]);

  const onEventDrop = useCallback(
    async (payload: {
      jobId: string;
      startTime: string;
      endTime: string;
      resourceId: string | null;
      recalculateEndFromPressSpeed?: boolean;
    }) => {
      const res = await fetch(schedApi(`jobs/${payload.jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: payload.startTime,
          endTime: payload.endTime,
          resourceId: payload.resourceId,
          ...(payload.recalculateEndFromPressSpeed
            ? { recalculateEndFromPressSpeed: true }
            : {}),
        }),
      });
      const data = await readOkJsonWithAuth<JobWithMachine>(res);
      setJobs((prev) => prev.map((j) => (j.id === data.id ? data : j)));
      setToast({ type: "ok", text: "Schedule updated." });
    },
    [],
  );

  const resources = machines.map((m) => ({ id: m.slug, title: m.name }));
  const events = jobsToCalendarEvents(jobs);

  function openJobDetail(id: string) {
    setDetailJobId(id);
    setDetailOpen(true);
  }

  const onOperatorToggle = useCallback(
    (jobId: string, nextActive: boolean) => {
      let name: string | undefined;
      try {
        name = sessionStorage.getItem("scheduler_operator_name") ?? undefined;
      } catch {
        name = undefined;
      }
      setOperatorActiveByJobId((prev) => ({ ...prev, [jobId]: nextActive }));
      void broadcastOperatorJob({
        jobId,
        active: nextActive,
        operatorName: name,
      });
    },
    [broadcastOperatorJob, setOperatorActiveByJobId],
  );

  async function signOut() {
    if (!auth || isAnonymousSchedulerSession(auth.user.id)) return;
    await fetch(schedApi("auth/logout"), { method: "POST" });
    window.location.href = `${SCHEDULER_BASE_PATH}/login`;
  }

  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100/80 dark:from-zinc-950 dark:to-zinc-900">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  const eff = auth.effective;
  const showSignOut = !isAnonymousSchedulerSession(auth.user.id);

  if (!eff.canViewSchedule) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/80 px-4 py-16 dark:from-zinc-950 dark:to-zinc-900">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No schedule access</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your account is signed in, but it doesn’t have permission to view the print schedule. Ask an
            admin to enable the “View schedule & jobs” permission for your user.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <LaminatingHomeLink
              className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}
            />
            {eff.canManageUsers ? (
              <Link
                href={`${SCHEDULER_BASE_PATH}/admin`}
                className={cn(buttonVariants({ variant: "default" }), "no-underline")}
              >
                <Shield className="size-4" />
                Admin
              </Link>
            ) : null}
            {showSignOut ? (
              <Button type="button" variant="secondary" onClick={() => void signOut()}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (auth.user.role === "MACHINE" && !auth.user.machineId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/80 px-4 py-16 dark:from-zinc-950 dark:to-zinc-900">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Press not assigned</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your account uses the Machine role but no press is linked yet. An admin must edit your user in{" "}
            <span className="font-medium">Admin</span> and choose an assigned press.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <LaminatingHomeLink
              className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}
            />
            {eff.canManageUsers ? (
              <Link
                href={`${SCHEDULER_BASE_PATH}/admin`}
                className={cn(buttonVariants({ variant: "default" }), "no-underline")}
              >
                <Shield className="size-4" />
                Admin
              </Link>
            ) : null}
            {showSignOut ? (
              <Button type="button" variant="secondary" onClick={() => void signOut()}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const tabSpecs = [
    ["schedule", "Schedule", true],
    ["completed", "Completed jobs", eff.canViewCompletedTab],
    ["cancelled", "Cancelled jobs", eff.canViewCancelledTab],
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/80 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200/80 pb-6 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
              Production
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Digital print
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Week grid (Gmail-style stacks per machine). Click a job for details and the original
              ticket PDF. Configure press speeds under Machines to estimate run times.
            </p>
            {auth.user.role === "MACHINE" && auth.user.machine ? (
              <p className="mt-2 text-sm font-medium text-sky-800 dark:text-sky-300">
                You are viewing only{" "}
                <span className="underline decoration-sky-400/80 underline-offset-2">
                  {auth.user.machine.name}
                </span>{" "}
                ({auth.user.machine.slug}).
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LaminatingHomeLink
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "no-underline",
              )}
            />
            <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">
              {auth.user.displayName}
            </span>
            {eff.canManageUsers ? (
              <Link
                href={`${SCHEDULER_BASE_PATH}/admin`}
                className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}
              >
                <Shield className="size-4" />
                Admin
              </Link>
            ) : null}
            {showSignOut ? (
              <Button variant="secondary" type="button" onClick={() => void signOut()}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            ) : null}
            <Button
              variant="secondary"
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
            >
              Refresh
            </Button>
            {eff.canManageMachines ? (
              <Button variant="secondary" type="button" onClick={() => setMachinesOpen(true)}>
                <Cog className="size-4" />
                Machines
              </Button>
            ) : null}
            {eff.canImportJobs ? (
              <Button type="button" onClick={() => setIntakeOpen(true)}>
                <Plus className="size-4" />
                New job
              </Button>
            ) : null}
          </div>
        </header>

        {toast ? (
          <p
            className={
              toast.type === "ok"
                ? "text-sm text-emerald-800 dark:text-emerald-400"
                : "text-sm text-red-700 dark:text-red-400"
            }
          >
            {toast.text}
          </p>
        ) : null}

        {loading && machines.length === 0 ? (
          <p className="text-sm text-zinc-500">Loading machines and jobs…</p>
        ) : loadFailed ? null : machines.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            No machines in the database yet. With{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">DATABASE_URL=&quot;file:./dev.db&quot;</code>{" "}
            run{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">npx prisma db push</code>{" "}
            then{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">npx prisma db seed</code>.
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Schedule views"
              className="flex flex-wrap gap-1 rounded-lg border border-zinc-200/80 bg-zinc-100/60 p-1 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              {tabSpecs
                .filter(([, , show]) => show)
                .map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mainView === id}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    mainView === id
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                  )}
                  onClick={() => setMainView(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {mainView === "schedule" ? (
              <WeekGridCalendar
                resources={resources}
                events={events}
                highlightEventId={flyJobId}
                onEventDrop={onEventDrop}
                onEventClick={openJobDetail}
                operatorActiveByJobId={operatorActiveByJobId}
                operatorName={operatorDisplayName}
                realtimeEnabled={REALTIME_CONFIGURED}
                onOperatorToggle={onOperatorToggle}
                readOnly={!eff.canEditSchedule}
              />
            ) : mainView === "completed" ? (
              <JobStatusLists variant="completed" jobs={jobs} onSelectJob={openJobDetail} />
            ) : (
              <JobStatusLists variant="cancelled" jobs={jobs} onSelectJob={openJobDetail} />
            )}

            {mainView === "schedule" &&
            !loading &&
            events.length === 0 &&
            machines.length > 0 ? (
              <p className="text-center text-sm text-zinc-500">
                No scheduled jobs yet — use New job to import a ticket and confirm placement.
              </p>
            ) : null}
          </>
        )}
      </div>

      <JobIntakeDrawer
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        machines={machines}
        onPlaced={(id) => {
          setFlyJobId(id);
          void loadAll();
        }}
        onToast={setToast}
      />

      <MachineManagerSheet
        open={machinesOpen}
        onOpenChange={setMachinesOpen}
        onSaved={() => void loadAll()}
        onToast={setToast}
      />

      <JobDetailDialog
        jobId={detailJobId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetailJobId(null);
        }}
        jobs={jobs}
        onJobUpdated={() => void loadAll()}
        onToast={setToast}
        canEditSchedule={eff.canEditSchedule}
      />
    </div>
  );
}
