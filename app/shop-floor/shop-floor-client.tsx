"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Timer } from "lucide-react";

type EmployeeRow = { id: string; name: string; requiresPin: boolean };

type OpenJob = {
  id: string;
  jobNumber: number | null;
  status: string;
  machineAssigned: string;
  scheduledStart: string | Date | null;
  estimate: {
    filmType: string;
    sheetSize: string;
    estimateNumber: number | null;
  } | null;
};

type ActiveTimer = {
  id: string;
  jobTicketId: string;
  activityKind: string;
  startedAt: string;
  notes: string | null;
  job: {
    id: string;
    jobNumber: number | null;
    status: string;
    machineAssigned: string;
  };
};

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function elapsed(startedAt: string) {
  const s = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export function ShopFloorClient() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [openJobs, setOpenJobs] = useState<OpenJob[]>([]);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [active, setActive] = useState<ActiveTimer | null>(null);

  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [pin, setPin] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);

  const [jobIdStart, setJobIdStart] = useState("");
  const [startNotes, setStartNotes] = useState("");
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [stopSheets, setStopSheets] = useState("");
  const [stopNotes, setStopNotes] = useState("");
  const [stopErr, setStopErr] = useState<string | null>(null);

  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpPin, setNewEmpPin] = useState("");
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [s, aj, e, oj] = await Promise.all([
      fetch("/api/shop-floor/session"),
      fetch("/api/shop-floor/active-timer"),
      fetch("/api/shop-floor/employees"),
      fetch("/api/shop-floor/open-jobs"),
    ]);
    const session = (await s.json()) as { employee: { id: string; name: string } | null };
    setMe(session.employee);
    if (!session.employee) {
      setActive(null);
    } else {
      if (aj.ok) {
        const a = (await aj.json()) as { active: ActiveTimer | null };
        setActive(a.active);
      }
    }
    if (e.ok) setEmployees((await e.json()) as EmployeeRow[]);
    if (oj.ok) setOpenJobs((await oj.json()) as OpenJob[]);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setStopSheets("");
    setStopNotes("");
    setStopErr(null);
  }, [active?.id]);

  async function login() {
    setLoginErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/shop-floor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmpId, pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLoginErr(data.error ?? "Login failed");
        return;
      }
      setPin("");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/shop-floor/session", { method: "DELETE" });
    setMe(null);
    setActive(null);
    await loadAll();
  }

  async function submitStopRun() {
    if (!active) return;
    const sheets = Number(stopSheets.trim());
    if (!Number.isInteger(sheets) || sheets < 1) {
      setStopErr("Enter how many sheets you ran (whole number, at least 1).");
      return;
    }
    setStopErr(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/job-tickets/${active.jobTicketId}/time-logs/${active.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetsRun: sheets,
            notes: stopNotes.trim() || active.notes || null,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStopErr(data.error ?? "Could not submit run");
        return;
      }
      await loadAll();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function startTimer() {
    if (!jobIdStart) {
      setActionErr("Select a job");
      return;
    }
    setActionErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/job-tickets/${jobIdStart}/time-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityKind: "LINE_TIME",
          notes: startNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionErr(data.error ?? "Could not start timer");
        return;
      }
      setStartNotes("");
      await loadAll();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addEmployee() {
    setAdminMsg(null);
    if (!newEmpName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/shop-floor/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmpName.trim(),
          pin: newEmpPin.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAdminMsg(data.error ?? "Could not add employee");
        return;
      }
      setNewEmpName("");
      setNewEmpPin("");
      setAdminMsg("Employee added.");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
            ← Home
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Timer className="size-7 text-[var(--dashboard-accent)]" strokeWidth={1.75} />
            Shop floor
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Sign in, start a run on a job, then stop and enter how many sheets you ran. Time applies to both
            machine and operator rates; film usage is calculated from sheets and the job quote.
          </p>
        </div>
        {me ? (
          <div className="text-right text-sm">
            <p className="font-medium text-zinc-900">{me.name}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-1 text-[var(--dashboard-accent)] hover:underline"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      {!me ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-900">Sign in</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-zinc-600">Employee</span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  setPin("");
                }}
              >
                <option value="">Choose…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.requiresPin ? " (PIN required)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {selectedEmp?.requiresPin ? (
              <label className="block text-sm">
                <span className="text-zinc-600">PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </label>
            ) : null}
            {loginErr ? <p className="text-sm text-red-600">{loginErr}</p> : null}
            <button
              type="button"
              disabled={busy || !selectedEmpId || (selectedEmp?.requiresPin && !pin)}
              onClick={() => void login()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
          {employees.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No employees yet. Add one below (shop tablet / trusted network).
            </p>
          ) : null}
        </section>
      ) : (
        <>
          {active ? (
            <section className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
              <h2 className="text-sm font-medium text-emerald-950">Run in progress</h2>
              <p className="mt-2 text-lg font-semibold text-emerald-950">
                Job{" "}
                {active.job.jobNumber != null ? `#${active.job.jobNumber}` : active.job.id.slice(0, 8)}
              </p>
              <p className="mt-1 text-sm text-emerald-900">
                Started {fmtShort(active.startedAt)} · Elapsed ~{elapsed(active.startedAt)}
              </p>
              <p className="mt-1 text-xs text-emerald-800">{active.job.machineAssigned}</p>

              <div className="mt-5 space-y-4 border-t border-emerald-200/80 pt-4">
                <p className="text-sm font-medium text-emerald-950">Finish this run</p>
                <p className="text-xs text-emerald-900">
                  Enter the number of sheets you ran so we can record time and estimate film used.
                </p>
                <label className="block text-sm">
                  <span className="text-emerald-950">Sheets ran</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    className="mt-1 w-full max-w-xs rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm tabular-nums"
                    value={stopSheets}
                    onChange={(e) => setStopSheets(e.target.value)}
                    placeholder="e.g. 2500"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-emerald-950">Notes (optional)</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm"
                    value={stopNotes}
                    onChange={(e) => setStopNotes(e.target.value)}
                    placeholder="e.g. Pass 2, splice"
                  />
                </label>
                {stopErr ? <p className="text-sm text-red-700">{stopErr}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitStopRun()}
                    className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
                  >
                    Submit run
                  </button>
                  <Link
                    href={`/jobs/${active.jobTicketId}`}
                    className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-100/80"
                  >
                    Open job
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">Start a run</h2>
            <p className="mt-1 text-xs text-zinc-500">
              You can only have one open timer. Finish the current run (with sheet count) before starting another.
            </p>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-zinc-600">Job</span>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  value={jobIdStart}
                  onChange={(e) => setJobIdStart(e.target.value)}
                  disabled={Boolean(active)}
                >
                  <option value="">Select job…</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobNumber != null ? `Job #${j.jobNumber}` : j.id.slice(0, 8)} — {j.status} —{" "}
                      {j.estimate?.sheetSize ?? "—"} / {j.estimate?.filmType ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600">Notes (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  placeholder="Shown on the time log; you can edit when finishing the run"
                  disabled={Boolean(active)}
                />
              </label>
              {actionErr ? <p className="text-sm text-red-600">{actionErr}</p> : null}
              <button
                type="button"
                disabled={busy || !jobIdStart || Boolean(active)}
                onClick={() => void startTimer()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Start run
              </button>
            </div>
          </section>
        </>
      )}

      <section className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-6">
        <h2 className="text-sm font-medium text-zinc-900">Add employee</h2>
        <p className="mt-1 text-xs text-zinc-500">
          PIN is optional. If set, this person must enter it when signing in.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block text-sm sm:min-w-[200px] sm:flex-1">
            <span className="text-zinc-600">Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={newEmpName}
              onChange={(e) => setNewEmpName(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:w-40">
            <span className="text-zinc-600">PIN (optional)</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={newEmpPin}
              onChange={(e) => setNewEmpPin(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || !newEmpName.trim()}
            onClick={() => void addEmployee()}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {adminMsg ? <p className="mt-3 text-sm text-zinc-700">{adminMsg}</p> : null}
      </section>
    </div>
  );
}
