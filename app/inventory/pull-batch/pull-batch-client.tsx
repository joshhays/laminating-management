"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const EPS = 1e-6;

type PreviewItem = {
  allocationId: string;
  jobTicketId: string;
  jobNumber: number | null;
  customerCompanyName: string | null;
  passOrder: number;
  rollDescription: string;
  rollStockKind: string;
  rollRemainingLinearFeet: number;
  estimatedLinearFeetSnapshot: number | null;
  estimatedFeetForVariance: number;
  allocatedLinearFeet: number;
  hasVarianceVsEstimate: boolean;
  suggestedPullLinearFeet: number;
};

type PreviewResponse = { items: PreviewItem[]; count: number };

function needsApprovalForPull(pull: number, estimatedFeetForVariance: number): boolean {
  return Math.abs(pull - estimatedFeetForVariance) > EPS;
}

export function PullBatchClient() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pullById, setPullById] = useState<Record<string, number>>({});
  const [approveById, setApproveById] = useState<Record<string, boolean>>({});
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/inventory/pull-batch/preview");
      const data = (await res.json()) as PreviewResponse & { error?: string };
      if (!res.ok) {
        setLoadError(typeof data.error === "string" ? data.error : "Could not load preview");
        return;
      }
      setPreview(data);
      const next: Record<string, number> = {};
      for (const row of data.items) {
        next[row.allocationId] = row.suggestedPullLinearFeet;
      }
      setPullById(next);
      setApproveById({});
    } catch {
      setLoadError("Could not load preview");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => preview?.items ?? [], [preview]);

  const pendingApprovalIds = useMemo(() => {
    return rows
      .filter((row) => {
        const pull = pullById[row.allocationId] ?? row.suggestedPullLinearFeet;
        return (
          needsApprovalForPull(pull, row.estimatedFeetForVariance) && !approveById[row.allocationId]
        );
      })
      .map((r) => r.allocationId);
  }, [rows, pullById, approveById]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (pendingApprovalIds.length > 0) {
      setSubmitError(
        "Approve every row where the pull amount differs from the estimate snapshot (checkboxes below).",
      );
      return;
    }
    setSubmitting(true);
    try {
      const items = rows.map((row) => ({
        allocationId: row.allocationId,
        pullLinearFeet: pullById[row.allocationId] ?? row.suggestedPullLinearFeet,
      }));
      const approvedVarianceAllocationIds = rows
        .filter((row) => {
          const pull = pullById[row.allocationId] ?? row.suggestedPullLinearFeet;
          return (
            needsApprovalForPull(pull, row.estimatedFeetForVariance) && approveById[row.allocationId]
          );
        })
        .map((row) => row.allocationId);

      const res = await fetch("/api/inventory/pull-batch/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pin.trim() || undefined,
          items,
          approvedVarianceAllocationIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        allocationIdsNeedingApproval?: string[];
      };
      if (!res.ok) {
        setSubmitError(
          typeof data.error === "string" ? data.error : "Batch pull failed",
        );
        return;
      }
      await load();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {loadError}{" "}
        <button type="button" className="underline" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!preview) {
    return <p className="text-sm text-zinc-600">Loading pending pulls…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No film allocations are waiting to be pulled. When jobs have pending allocations, they appear
        here for end-of-day verification.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <p className="text-sm text-zinc-600">
        Set the linear feet to pull for each line. If the pull differs from the{" "}
        <span className="font-medium text-zinc-800">estimate snapshot</span> (from job conversion), check
        the approval box for that row, then run the batch. Optional env{" "}
        <code className="rounded bg-zinc-100 px-1">ADMIN_PIN</code> is required when set.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Pass</th>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2 text-right">Est. (snapshot)</th>
              <th className="px-3 py-2 text-right">Pull (lin. ft)</th>
              <th className="px-3 py-2">Approve variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => {
              const pull = pullById[row.allocationId] ?? row.suggestedPullLinearFeet;
              const needs = needsApprovalForPull(pull, row.estimatedFeetForVariance);
              return (
                <tr key={row.allocationId} className="bg-white">
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900">
                      {row.jobNumber != null ? `Job #${row.jobNumber}` : row.jobTicketId.slice(0, 8)}
                    </div>
                    {row.customerCompanyName ? (
                      <div className="text-xs text-zinc-500">{row.customerCompanyName}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-700">{row.passOrder}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    <span className="line-clamp-2">{row.rollDescription}</span>
                    <div className="text-xs text-zinc-500">
                      {row.rollStockKind === "CATALOG" ? "Catalog" : "On-floor"} ·{" "}
                      {row.rollRemainingLinearFeet.toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
                      ft on roll
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                    {row.estimatedFeetForVariance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      className="w-28 rounded border border-zinc-300 px-2 py-1 text-right tabular-nums"
                      value={Number.isFinite(pull) ? pull : ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setPullById((prev) => ({
                          ...prev,
                          [row.allocationId]: Number.isFinite(v) ? v : row.suggestedPullLinearFeet,
                        }));
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {needs ? (
                      <label className="flex items-center gap-2 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          checked={Boolean(approveById[row.allocationId])}
                          onChange={(e) =>
                            setApproveById((prev) => ({
                              ...prev,
                              [row.allocationId]: e.target.checked,
                            }))
                          }
                        />
                        Approve pull vs estimate
                      </label>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Admin PIN (if configured)</label>
          <input
            type="password"
            autoComplete="off"
            className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "Pulling…" : "Verify and pull all"}
        </button>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
    </form>
  );
}
