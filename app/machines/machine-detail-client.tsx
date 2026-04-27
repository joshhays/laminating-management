"use client";

import type {
  Machine,
  MachineSpeedReductionRule,
  MachineSpoilageRule,
  MachineType,
} from "@prisma/client";
import { MachineTypeKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatMachineTypeOptionLabel } from "@/lib/machine-type-labels";
import {
  usesCutterEstimateFields,
  usesLaminatorLineFieldsCreate,
  usesSimpleEquipmentProfile,
} from "@/lib/machine-equipment-profile";
import { MachineSpeedReductionRulesClient } from "./machine-speed-reduction-rules-client";
import { MachineSpoilageRulesClient } from "./machine-spoilage-rules-client";

type MachineWithRules = Machine & {
  speedReductionRules: MachineSpeedReductionRule[];
  spoilageRules: MachineSpoilageRule[];
  machineType: MachineType | null;
};

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MachineDetailClient({ initial }: { initial: MachineWithRules }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [maxWidthInches, setMaxWidthInches] = useState(String(initial.maxWidthInches));
  const [maxSpeedMetersMin, setMaxSpeedMetersMin] = useState(String(initial.maxSpeedMetersMin));
  const [maxTotalSlowdownPercent, setMaxTotalSlowdownPercent] = useState(
    String(initial.maxTotalSlowdownPercent ?? 100),
  );
  const [hourlyRate, setHourlyRate] = useState(String(initial.hourlyRate));
  const [laborHourlyRate, setLaborHourlyRate] = useState(String(initial.laborHourlyRate));
  const [makeReadyMinutes, setMakeReadyMinutes] = useState(String(initial.makeReadyMinutes));
  const [extraMakeReadyDigitalMinutes, setExtraMakeReadyDigitalMinutes] = useState(
    String(initial.extraMakeReadyDigitalMinutes ?? 0),
  );
  const [extraMakeReadyOffsetMinutes, setExtraMakeReadyOffsetMinutes] = useState(
    String(initial.extraMakeReadyOffsetMinutes ?? 0),
  );
  const [sideChangeMinutes, setSideChangeMinutes] = useState(String(initial.sideChangeMinutes));
  const [washUpMinutes, setWashUpMinutes] = useState(String(initial.washUpMinutes));
  const [spoilagePercent, setSpoilagePercent] = useState(String(initial.spoilagePercent));
  const [pricePerCut, setPricePerCut] = useState(String(initial.pricePerCut ?? 0));
  const [cutterMaxHeightInches, setCutterMaxHeightInches] = useState(
    initial.cutterMaxHeightInches != null ? String(initial.cutterMaxHeightInches) : "",
  );
  const [cutterMaxWeight, setCutterMaxWeight] = useState(
    initial.cutterMaxWeight != null ? String(initial.cutterMaxWeight) : "",
  );
  const [cutterOversizeMinLongEdgeInches, setCutterOversizeMinLongEdgeInches] = useState(
    initial.cutterOversizeMinLongEdgeInches != null
      ? String(initial.cutterOversizeMinLongEdgeInches)
      : "",
  );
  const [cutterOversizeMaxLiftHeightInches, setCutterOversizeMaxLiftHeightInches] = useState(
    initial.cutterOversizeMaxLiftHeightInches != null
      ? String(initial.cutterOversizeMaxLiftHeightInches)
      : "",
  );
  const [cutterHelperLaborHourlyRate, setCutterHelperLaborHourlyRate] = useState(
    initial.cutterHelperLaborHourlyRate != null
      ? String(initial.cutterHelperLaborHourlyRate)
      : "",
  );
  const [cutterBaseSetupHours, setCutterBaseSetupHours] = useState(
    String(initial.cutterBaseSetupHours ?? 0),
  );
  const [cutterBuildLiftHours, setCutterBuildLiftHours] = useState(
    String(initial.cutterBuildLiftHours ?? 0),
  );
  const [cutterAdditionalSetupHoursPerCut, setCutterAdditionalSetupHoursPerCut] = useState(
    String(initial.cutterAdditionalSetupHoursPerCut ?? 0),
  );
  const [cutterPerCutHours, setCutterPerCutHours] = useState(String(initial.cutterPerCutHours ?? 0));
  const [cutterMakeReadySpoilagePercent, setCutterMakeReadySpoilagePercent] = useState(
    initial.cutterMakeReadySpoilagePercent != null
      ? String(initial.cutterMakeReadySpoilagePercent)
      : "",
  );
  const [cutterMinCutsEnabled, setCutterMinCutsEnabled] = useState(initial.cutterMinCutsEnabled);
  const [minSheetWidthInches, setMinSheetWidthInches] = useState(
    initial.minSheetWidthInches != null ? String(initial.minSheetWidthInches) : "",
  );
  const [maxSheetWidthInches, setMaxSheetWidthInches] = useState(
    initial.maxSheetWidthInches != null ? String(initial.maxSheetWidthInches) : "",
  );
  const [minSheetLengthInches, setMinSheetLengthInches] = useState(
    initial.minSheetLengthInches != null ? String(initial.minSheetLengthInches) : "",
  );
  const [maxSheetLengthInches, setMaxSheetLengthInches] = useState(
    initial.maxSheetLengthInches != null ? String(initial.maxSheetLengthInches) : "",
  );
  const [machineTypeId, setMachineTypeId] = useState(initial.machineTypeId ?? "");
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [active, setActive] = useState(initial.active);
  const [technicalSpecsJson, setTechnicalSpecsJson] = useState(() => {
    const v = initial.technicalSpecs;
    if (v == null || v === undefined) return "{}";
    return JSON.stringify(v, null, 2);
  });
  const [cutterDetailTab, setCutterDetailTab] = useState<"cutter" | "hourly">("cutter");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/machine-types")
      .then((r) => r.json())
      .then((data: MachineType[]) => {
        if (Array.isArray(data)) setMachineTypes(data);
      })
      .catch(() => {});
  }, []);

  const resolvedType = useMemo((): MachineType | null => {
    if (machineTypeId.trim() === "") return null;
    return machineTypes.find((x) => x.id === machineTypeId) ?? initial.machineType ?? null;
  }, [machineTypes, machineTypeId, initial.machineType]);

  const isCutterProfile = usesCutterEstimateFields(resolvedType);
  const showLineMachineForm = usesLaminatorLineFieldsCreate(resolvedType);
  const showSimpleProfile = resolvedType != null && usesSimpleEquipmentProfile(resolvedType);
  const showScheduleRules = !isCutterProfile && !showSimpleProfile && showLineMachineForm;

  async function handleSaveMachine(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let technicalSpecs: unknown = {};
      try {
        technicalSpecs = JSON.parse(technicalSpecsJson || "{}") as unknown;
      } catch {
        setError("Technical specs must be valid JSON");
        setSaving(false);
        return;
      }

      const basePayload: Record<string, unknown> = {
          name: name.trim(),
        hourlyRate: Number(hourlyRate || 0),
        laborHourlyRate: Number(laborHourlyRate || 0),
        machineTypeId: machineTypeId.trim() === "" ? null : machineTypeId.trim(),
        notes: notes.trim() || null,
        active,
        technicalSpecs,
      };

      if (isCutterProfile) {
        basePayload.spoilagePercent = Number(spoilagePercent || 0);
        basePayload.pricePerCut = Number(pricePerCut || 0);
        basePayload.cutterMaxHeightInches =
          cutterMaxHeightInches.trim() === "" ? null : Number(cutterMaxHeightInches);
        basePayload.cutterMaxWeight =
          cutterMaxWeight.trim() === "" ? null : Number(cutterMaxWeight);
        basePayload.cutterOversizeMinLongEdgeInches =
          cutterOversizeMinLongEdgeInches.trim() === ""
            ? null
            : Number(cutterOversizeMinLongEdgeInches);
        basePayload.cutterOversizeMaxLiftHeightInches =
          cutterOversizeMaxLiftHeightInches.trim() === ""
            ? null
            : Number(cutterOversizeMaxLiftHeightInches);
        basePayload.cutterHelperLaborHourlyRate =
          cutterHelperLaborHourlyRate.trim() === ""
            ? null
            : Number(cutterHelperLaborHourlyRate);
        basePayload.cutterBaseSetupHours = Number(cutterBaseSetupHours || 0);
        basePayload.cutterBuildLiftHours = Number(cutterBuildLiftHours || 0);
        basePayload.cutterAdditionalSetupHoursPerCut = Number(
          cutterAdditionalSetupHoursPerCut || 0,
        );
        basePayload.cutterPerCutHours = Number(cutterPerCutHours || 0);
        basePayload.cutterMakeReadySpoilagePercent =
          cutterMakeReadySpoilagePercent.trim() === ""
            ? null
            : Number(cutterMakeReadySpoilagePercent);
        basePayload.cutterMinCutsEnabled = cutterMinCutsEnabled;
        basePayload.maxWidthInches = Number(maxWidthInches);
        basePayload.maxSpeedMetersMin = Number(maxSpeedMetersMin);
      } else if (showSimpleProfile) {
        Object.assign(basePayload, {
          maxWidthInches: Number(maxWidthInches),
          maxSpeedMetersMin: Number(maxSpeedMetersMin),
          maxTotalSlowdownPercent: Number(maxTotalSlowdownPercent || 100),
          makeReadyMinutes: 0,
          extraMakeReadyDigitalMinutes: 0,
          extraMakeReadyOffsetMinutes: 0,
          sideChangeMinutes: 0,
          washUpMinutes: 0,
          spoilagePercent: 0,
          pricePerCut: 0,
        });
      } else {
        Object.assign(basePayload, {
          maxWidthInches: Number(maxWidthInches),
          maxSpeedMetersMin: Number(maxSpeedMetersMin),
          maxTotalSlowdownPercent: Number(maxTotalSlowdownPercent || 100),
          makeReadyMinutes: Number(makeReadyMinutes || 0),
          extraMakeReadyDigitalMinutes: Number(extraMakeReadyDigitalMinutes || 0),
          extraMakeReadyOffsetMinutes: Number(extraMakeReadyOffsetMinutes || 0),
          sideChangeMinutes: Number(sideChangeMinutes || 0),
          washUpMinutes: Number(washUpMinutes || 0),
          spoilagePercent: Number(spoilagePercent || 0),
          pricePerCut: Number(pricePerCut || 0),
          minSheetWidthInches: minSheetWidthInches.trim() === "" ? null : Number(minSheetWidthInches),
          maxSheetWidthInches: maxSheetWidthInches.trim() === "" ? null : Number(maxSheetWidthInches),
          minSheetLengthInches:
            minSheetLengthInches.trim() === "" ? null : Number(minSheetLengthInches),
          maxSheetLengthInches:
            maxSheetLengthInches.trim() === "" ? null : Number(maxSheetLengthInches),
        });
      }

      const res = await fetch(`/api/machines/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload),
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

  async function handleDelete() {
    if (!confirm("Delete this machine? Jobs and estimates will be unlinked.")) return;
    const res = await fetch(`/api/machines/${initial.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete");
      return;
    }
    router.push("/module-setup/estimating");
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <form
        onSubmit={(e) => void handleSaveMachine(e)}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-medium text-zinc-900">
          {isCutterProfile
            ? "Cutter equipment"
            : showSimpleProfile
              ? "Finishing / mailing equipment"
              : resolvedType?.kind === MachineTypeKind.PRESS
                ? "Press equipment"
                : "Laminating line equipment"}
        </h2>
        <p className="text-xs text-zinc-500">
          {isCutterProfile
            ? "Setup times are in hours (matching shop floor cutters). Line speed fields below are kept for database compatibility — laminating estimates still use laminator records."
            : showSimpleProfile
              ? "Hourly rates and technical specs (JSON). No laminator speed or spoilage rules on this profile."
              : "Line speed, sheet bounds, spoilage bands, and reduction rules drive estimate run time."}
        </p>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Machine type
          </span>
          <select
            value={machineTypeId}
            onChange={(e) => setMachineTypeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— None (treat as laminator) —</option>
            {machineTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {formatMachineTypeOptionLabel(t)}
              </option>
            ))}
          </select>
        </label>

        {isCutterProfile ? (
          <>
            <div className="flex gap-6 border-b border-zinc-200">
              <button
                type="button"
                onClick={() => setCutterDetailTab("cutter")}
                className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                  cutterDetailTab === "cutter"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Cutter
              </button>
              <button
                type="button"
                onClick={() => setCutterDetailTab("hourly")}
                className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                  cutterDetailTab === "hourly"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Hourly rates
              </button>
            </div>

            {cutterDetailTab === "cutter" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-red-700">
                    Description
                  </span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="e.g. Large Cutter"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Max height (in)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cutterMaxHeightInches}
                    onChange={(e) => setCutterMaxHeightInches(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                    placeholder='e.g. 4"'
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Max weight
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cutterMaxWeight}
                    onChange={(e) => setCutterMaxWeight(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                    placeholder="e.g. 250"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Lift / pile limit (shop units, e.g. lb).</p>
                </label>

                <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                    Oversize sheets
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    When max(trim width, trim length) is at least the threshold, estimates may use a lower
                    max stack (more lifts) and a higher labor $/hr (e.g. helper). Leave blank to disable.
                    Effective stack is min(normal max height, oversize max lift).
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Long edge from (in)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={cutterOversizeMinLongEdgeInches}
                        onChange={(e) => setCutterOversizeMinLongEdgeInches(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                        placeholder="e.g. 40"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Max lift height when oversize (in)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={cutterOversizeMaxLiftHeightInches}
                        onChange={(e) => setCutterOversizeMaxLiftHeightInches(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                        placeholder="Smaller than normal max"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Helper labor $/hr when oversize
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={cutterHelperLaborHourlyRate}
                        onChange={(e) => setCutterHelperLaborHourlyRate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                        placeholder="Replaces labor $/hr on Hourly tab for cutter hours only"
                      />
                    </label>
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Base setup (hours)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cutterBaseSetupHours}
                    onChange={(e) => setCutterBaseSetupHours(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Additional setup per cut (hours)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cutterAdditionalSetupHoursPerCut}
                    onChange={(e) => setCutterAdditionalSetupHoursPerCut(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Build lift time (hours)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cutterBuildLiftHours}
                    onChange={(e) => setCutterBuildLiftHours(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Per cut time (hours)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cutterPerCutHours}
                    onChange={(e) => setCutterPerCutHours(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Make ready spoilage (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={cutterMakeReadySpoilagePercent}
                    onChange={(e) => setCutterMakeReadySpoilagePercent(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Run spoilage (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={spoilagePercent}
                    onChange={(e) => setSpoilagePercent(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Price per cut (USD)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={pricePerCut}
                    onChange={(e) => setPricePerCut(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Optional list price per stroke; estimates use{" "}
                    <strong className="font-medium text-zinc-700">labor hours × Labor $/hr</strong>{" "}
                    from the Hourly rates tab.
                  </p>
                </label>

                <label className="flex cursor-pointer items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={cutterMinCutsEnabled}
                    onChange={(e) => setCutterMinCutsEnabled(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <span className="text-sm text-zinc-800">Min cuts</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 pt-6 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <span className="text-sm text-zinc-800">Active (shown in pickers)</span>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}

            {cutterDetailTab === "hourly" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Machine $/hr
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Labor $/hr
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={laborHourlyRate}
                    onChange={(e) => setLaborHourlyRate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Estimates: same cutter hours × machine $/hr and × labor $/hr, then added together.
                  </p>
                </label>

                <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Legacy line fields
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Stored for compatibility. Not used for cutter estimate math.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs text-zinc-500">Max width (in)</span>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={maxWidthInches}
                        onChange={(e) => setMaxWidthInches(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-zinc-500">Max speed (m/min)</span>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={maxSpeedMetersMin}
                        onChange={(e) => setMaxSpeedMetersMin(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                  </div>
                </div>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Technical specs (JSON)
                  </span>
                  <textarea
                    value={technicalSpecsJson}
                    onChange={(e) => setTechnicalSpecsJson(e.target.value)}
                    rows={6}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
                  />
                </label>
              </div>
            )}
          </>
        ) : showSimpleProfile ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Max width (in)
              </span>
              <input
                required
                type="number"
                min={0.001}
                step="any"
                value={maxWidthInches}
                onChange={(e) => setMaxWidthInches(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Max speed (m/min)
              </span>
              <input
                required
                type="number"
                min={0.001}
                step="any"
                value={maxSpeedMetersMin}
                onChange={(e) => setMaxSpeedMetersMin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Machine $/hr
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Labor $/hr
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={laborHourlyRate}
                onChange={(e) => setLaborHourlyRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span className="text-sm text-zinc-800">Active (shown in pickers)</span>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Technical specs (JSON)
              </span>
              <textarea
                value={technicalSpecsJson}
                onChange={(e) => setTechnicalSpecsJson(e.target.value)}
                rows={8}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Max width (in)
            </span>
            <input
              required
              type="number"
              min={0.001}
              step="any"
              value={maxWidthInches}
              onChange={(e) => setMaxWidthInches(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Max speed (m/min)
            </span>
            <input
              required
              type="number"
              min={0.001}
              step="any"
              value={maxSpeedMetersMin}
              onChange={(e) => setMaxSpeedMetersMin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Base line speed before reduction rules (each matching rule subtracts a %).
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Max total slowdown (%)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={maxTotalSlowdownPercent}
              onChange={(e) => setMaxTotalSlowdownPercent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
            />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Make ready (min)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={makeReadyMinutes}
                onChange={(e) => setMakeReadyMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Extra make ready — Digital (min)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={extraMakeReadyDigitalMinutes}
                onChange={(e) => setExtraMakeReadyDigitalMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Added to base make ready when the estimate’s print process is Digital.
              </p>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Extra make ready — Offset (min)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={extraMakeReadyOffsetMinutes}
                onChange={(e) => setExtraMakeReadyOffsetMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            <p className="mt-1 text-xs text-zinc-500">
                Added to base make ready when the estimate’s print process is Offset.
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Side change (min)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={sideChangeMinutes}
                onChange={(e) => setSideChangeMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
              <p className="mt-1 text-xs text-zinc-500">Between passes on two-sided jobs.</p>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Wash up (min)
            </span>
            <input
              type="number"
              min={0}
              step="any"
                value={washUpMinutes}
                onChange={(e) => setWashUpMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Default spoilage (% of sheets)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                value={spoilagePercent}
                onChange={(e) => setSpoilagePercent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
            />
          </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Min sheet width (in)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={minSheetWidthInches}
                onChange={(e) => setMinSheetWidthInches(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Max sheet width (in)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={maxSheetWidthInches}
                onChange={(e) => setMaxSheetWidthInches(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Min sheet length (in)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={minSheetLengthInches}
                onChange={(e) => setMinSheetLengthInches(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Max sheet length (in)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={maxSheetLengthInches}
                onChange={(e) => setMaxSheetLengthInches(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                placeholder="Optional"
              />
            </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Machine $/hr
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
            />
            <p className="mt-1 text-xs text-zinc-500">
                Line running time × {money(Number(hourlyRate || 0))}/hr
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Labor $/hr
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={laborHourlyRate}
              onChange={(e) => setLaborHourlyRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-800">Active (shown in estimate & job pickers)</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Technical specs (JSON)
            </span>
            <textarea
              value={technicalSpecsJson}
              onChange={(e) => setTechnicalSpecsJson(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
                placeholder='{"heatingMethod":"oil"}'
            />
          </label>
        </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save machine"}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="text-sm text-red-700 underline"
          >
            Delete machine
          </button>
        </div>
      </form>

      {showScheduleRules && (
        <>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <MachineSpeedReductionRulesClient
          key={`${initial.id}-red-${initial.updatedAt.toISOString()}`}
          machineId={initial.id}
          initialRules={initial.speedReductionRules}
        />
      </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <MachineSpoilageRulesClient
              key={`${initial.id}-spoil-${initial.updatedAt.toISOString()}`}
              machineId={initial.id}
              initialRules={initial.spoilageRules}
            />
          </div>
        </>
      )}
    </div>
  );
}
