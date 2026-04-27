"use client";

import {
  conversionLaborCost,
  conversionMachineCost,
} from "@/lib/job-conversion-costs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export type MachinePickerRow = {
  id: string;
  name: string;
  notes: string | null;
  hourlyRate: number;
  laborHourlyRate: number;
  active: boolean;
};

type Props = {
  jobId: string;
  initialMachineId: string | null;
  initialOperatorNotes: string | null;
  trackedRunHours: number | null;
  actualFilmUsd: number;
};

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTrackedHours(h: number | null | undefined) {
  if (h == null || !Number.isFinite(h) || h <= 0) return "—";
  return `${h.toLocaleString(undefined, { maximumFractionDigits: 2 })} hr`;
}

export function JobShopFloorClient({
  jobId,
  initialMachineId,
  initialOperatorNotes,
  trackedRunHours,
  actualFilmUsd,
}: Props) {
  const router = useRouter();
  const [machines, setMachines] = useState<MachinePickerRow[]>([]);
  const [machineId, setMachineId] = useState(initialMachineId ?? "");
  const [operatorNotes, setOperatorNotes] = useState(initialOperatorNotes ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMachines = useCallback(async () => {
    try {
      const res = await fetch("/api/machines");
      if (!res.ok) throw new Error("Failed to load machines");
      const raw = (await res.json()) as Array<{
        id: string;
        name: string;
        notes: string | null;
        hourlyRate: number;
        laborHourlyRate: number;
        active: boolean;
      }>;
      setMachines(
        raw.map((m) => ({
          id: m.id,
          name: m.name,
          notes: m.notes,
          hourlyRate: m.hourlyRate,
          laborHourlyRate: m.laborHourlyRate,
          active: m.active,
        })),
      );
    } catch {
      setMachines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMachines();
  }, [loadMachines]);

  useEffect(() => {
    setMachineId(initialMachineId ?? "");
  }, [initialMachineId]);

  useEffect(() => {
    setOperatorNotes(initialOperatorNotes ?? "");
  }, [initialOperatorNotes]);

  const selectedMachine = useMemo(() => {
    if (!machineId) return null;
    return machines.find((m) => m.id === machineId) ?? null;
  }, [machineId, machines]);

  const rates = selectedMachine
    ? {
        hourlyRate: selectedMachine.hourlyRate,
        laborHourlyRate: selectedMachine.laborHourlyRate,
      }
    : null;

  const machineCost = conversionMachineCost(trackedRunHours, rates);
  const laborCost = conversionLaborCost(trackedRunHours, rates);
  const film = actualFilmUsd;
  const totalConversion = film + machineCost + laborCost;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        operatorNotes: operatorNotes.trim() || null,
        machineId: machineId || null,
      };
      const res = await fetch(`/api/job-tickets/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const pickerOptions = machines.filter(
    (m) => m.active || m.id === initialMachineId,
  );

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
      <p className="text-sm text-zinc-600">
        Run hours come from the{" "}
        <Link href="/shop-floor" className="font-medium text-zinc-900 underline hover:no-underline">
          shop floor
        </Link>
        . Machine and operator rates both multiply the same run time. This form only assigns the machine (for
        rates) and operator notes.
      </p>

      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tracked run time (read-only)
        </h4>
        <p className="mt-1 text-xs text-zinc-500">
          Stopped runs with a sheet count roll up here for machine $ and labor $.
        </p>
        <dl className="mt-2">
          <div>
            <dt className="text-zinc-500">Total run hours</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">{formatTrackedHours(trackedRunHours)}</dd>
          </div>
        </dl>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading machines…</p>
      ) : (
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Machine</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          >
            <option value="">Not assigned</option>
            {pickerOptions.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.active && m.id !== initialMachineId}>
                {m.name}
                {!m.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
          {selectedMachine?.notes?.trim() && (
            <p className="mt-1 text-xs text-zinc-500">{selectedMachine.notes}</p>
          )}
        </label>
      )}

      <label className="block text-sm">
        <span className="font-medium text-zinc-800">Operator notes</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          rows={3}
          value={operatorNotes}
          onChange={(e) => setOperatorNotes(e.target.value)}
        />
      </label>

      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Conversion costs (tracked time &amp; sheets ran)
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Film from shop-floor sheet counts vs the quote. Machine and operator lines both use the run hours above.
        </p>
        <dl className="mt-3 space-y-2 tabular-nums">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Film (from sheets ran)</dt>
            <dd className="font-medium text-zinc-900">${money(film)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Machine</dt>
            <dd className="font-medium text-zinc-900">${money(machineCost)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Operator / labor</dt>
            <dd className="font-medium text-zinc-900">${money(laborCost)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-zinc-200 pt-2">
            <dt className="font-medium text-zinc-800">Total (film + machine + labor)</dt>
            <dd className="font-semibold text-zinc-900">${money(totalConversion)}</dd>
          </div>
        </dl>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save machine & notes"}
      </button>
    </form>
  );
}
