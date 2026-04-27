"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FilmAlloc = {
  id: string;
  passOrder: number;
  status: string;
  allocatedLinearFeet: number;
  estimatedLinearFeetSnapshot: number | null;
};

type TimeLogRow = {
  id: string;
  activityKind: string;
  startedAt: string;
  endedAt: string | null;
  sheetsRun: number | null;
  notes: string | null;
  employeeName: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function JobAdminEdits(props: {
  jobId: string;
  filmAllocations: FilmAlloc[];
  timeLogs: TimeLogRow[];
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingAllocs = props.filmAllocations.filter((a) => a.status === "ALLOCATED");

  async function patchJson(url: string, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, pin: pin.trim() || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Request failed");
      return false;
    }
    setMessage("Saved.");
    router.refresh();
    return true;
  }

  return (
    <div className="mt-6 space-y-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-amber-900/80">
          Admin corrections
        </h4>
        <p className="mt-1 text-xs text-amber-900/70">
          Adjust pending film allocation or time logs. Set optional env{" "}
          <code className="rounded bg-amber-100 px-1">ADMIN_PIN</code> to require the PIN on each save.
        </p>
        <label className="mt-3 block text-xs font-medium text-amber-900/80">Admin PIN</label>
        <input
          type="password"
          autoComplete="off"
          className="mt-1 w-full max-w-xs rounded border border-amber-200 bg-white px-2 py-1.5 text-sm"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="If configured"
        />
      </div>

      {message && <p className="text-sm text-emerald-800">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {pendingAllocs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80">
            Pending film allocation (lin. ft)
          </p>
          {pendingAllocs.map((a) => (
            <form
              key={a.id}
              className="flex flex-wrap items-end gap-2 border-t border-amber-200/80 pt-3 first:border-t-0 first:pt-0"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const feet = Number(fd.get("allocatedLinearFeet"));
                void patchJson(`/api/job-tickets/${props.jobId}/film-allocations/${a.id}`, {
                  allocatedLinearFeet: feet,
                });
              }}
            >
              <span className="text-sm text-amber-950">
                Pass {a.passOrder}
                {a.estimatedLinearFeetSnapshot != null && (
                  <span className="ml-2 text-xs text-amber-800/80">
                    (snapshot {a.estimatedLinearFeetSnapshot.toFixed(2)} ft)
                  </span>
                )}
              </span>
              <input
                name="allocatedLinearFeet"
                type="number"
                min={0.01}
                step="0.01"
                defaultValue={a.allocatedLinearFeet}
                className="w-32 rounded border border-amber-200 bg-white px-2 py-1 text-right text-sm tabular-nums"
              />
              <button
                type="submit"
                className="rounded bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950"
              >
                Save allocation
              </button>
            </form>
          ))}
        </div>
      )}

      {props.timeLogs.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80">Time logs</p>
          {props.timeLogs.map((log) => {
            const isLine = log.activityKind === "LINE_TIME";
            const isOpen = log.endedAt == null;
            return (
              <form
                key={log.id}
                className="space-y-2 border-t border-amber-200/80 pt-4 first:border-t-0 first:pt-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const body: Record<string, unknown> = {};
                  const s = fd.get("startedAt");
                  if (typeof s === "string" && s.trim() !== "") {
                    body.startedAt = new Date(s).toISOString();
                  }
                  if (!isOpen) {
                    const en = fd.get("endedAt");
                    if (typeof en === "string" && en.trim() !== "") {
                      body.endedAt = new Date(en).toISOString();
                    }
                  }
                  if (isLine && !isOpen) {
                    const sh = fd.get("sheetsRun");
                    if (typeof sh === "string" && sh.trim() !== "") {
                      body.sheetsRun = Number(sh);
                    }
                  }
                  body.notes = String(fd.get("notes") ?? "");
                  void patchJson(`/api/job-tickets/${props.jobId}/time-logs/${log.id}/admin`, body);
                }}
              >
                <p className="text-sm font-medium text-amber-950">
                  {log.employeeName}{" "}
                  <span className="font-normal text-amber-900/80">
                    · {isLine ? "Run" : "Labor"} · {log.id.slice(0, 8)}…
                  </span>
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs text-amber-900/80">
                    Started
                    <input
                      name="startedAt"
                      type="datetime-local"
                      defaultValue={toLocalDatetimeValue(log.startedAt)}
                      className="mt-0.5 w-full rounded border border-amber-200 bg-white px-2 py-1 text-sm"
                    />
                  </label>
                  {!isOpen && (
                    <label className="block text-xs text-amber-900/80">
                      Ended
                      <input
                        name="endedAt"
                        type="datetime-local"
                        defaultValue={log.endedAt ? toLocalDatetimeValue(log.endedAt) : ""}
                        className="mt-0.5 w-full rounded border border-amber-200 bg-white px-2 py-1 text-sm"
                      />
                    </label>
                  )}
                  {isLine && !isOpen && (
                    <label className="block text-xs text-amber-900/80 sm:col-span-2">
                      Sheets (only if no film movements recorded for this run)
                      <input
                        name="sheetsRun"
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={log.sheetsRun ?? ""}
                        className="mt-0.5 w-32 rounded border border-amber-200 bg-white px-2 py-1 text-sm"
                      />
                    </label>
                  )}
                  <label className="block text-xs text-amber-900/80 sm:col-span-2">
                    Notes
                    <textarea
                      name="notes"
                      rows={2}
                      defaultValue={log.notes ?? ""}
                      className="mt-0.5 w-full rounded border border-amber-200 bg-white px-2 py-1 text-sm"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-2 rounded bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950"
                >
                  Save time log
                </button>
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
