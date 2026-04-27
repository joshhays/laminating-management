"use client";

import type { MachineType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EstimatingEquipmentSection } from "@/lib/estimating-equipment-filters";
import { formatMachineTypeOptionLabel } from "@/lib/machine-type-labels";
import {
  usesCutterEstimateFields,
  usesLaminatorLineFieldsCreate,
  usesSimpleEquipmentProfile,
} from "@/lib/machine-equipment-profile";

export function AddMachineForm({
  machineTypes,
  estimatingSection,
  allowUntyped = true,
}: {
  machineTypes: MachineType[];
  estimatingSection?: EstimatingEquipmentSection;
  allowUntyped?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [machineTypeId, setMachineTypeId] = useState("");
  const [maxWidthInches, setMaxWidthInches] = useState("");
  const [maxSpeedMetersMin, setMaxSpeedMetersMin] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [laborHourlyRate, setLaborHourlyRate] = useState("0");
  const [makeReadyMinutes, setMakeReadyMinutes] = useState("0");
  const [extraMakeReadyDigitalMinutes, setExtraMakeReadyDigitalMinutes] = useState("0");
  const [extraMakeReadyOffsetMinutes, setExtraMakeReadyOffsetMinutes] = useState("0");
  const [sideChangeMinutes, setSideChangeMinutes] = useState("0");
  const [washUpMinutes, setWashUpMinutes] = useState("0");
  const [spoilagePercent, setSpoilagePercent] = useState("0");
  const [pricePerCut, setPricePerCut] = useState("0");
  const [cutterMaxHeightInches, setCutterMaxHeightInches] = useState("");
  const [cutterMaxWeight, setCutterMaxWeight] = useState("");
  const [cutterOversizeMinLongEdgeInches, setCutterOversizeMinLongEdgeInches] = useState("");
  const [cutterOversizeMaxLiftHeightInches, setCutterOversizeMaxLiftHeightInches] = useState("");
  const [cutterHelperLaborHourlyRate, setCutterHelperLaborHourlyRate] = useState("");
  const [cutterBaseSetupHours, setCutterBaseSetupHours] = useState("0");
  const [cutterBuildLiftHours, setCutterBuildLiftHours] = useState("0");
  const [cutterAdditionalSetupHoursPerCut, setCutterAdditionalSetupHoursPerCut] = useState("0");
  const [cutterPerCutHours, setCutterPerCutHours] = useState("0");
  const [cutterMakeReadySpoilagePercent, setCutterMakeReadySpoilagePercent] = useState("");
  const [cutterMinCutsEnabled, setCutterMinCutsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = useMemo(
    () => machineTypes.find((x) => x.id === machineTypeId) ?? null,
    [machineTypes, machineTypeId],
  );
  const isCutterProfile =
    selectedType != null ? usesCutterEstimateFields(selectedType) : false;
  const showLineFields =
    machineTypeId.trim() === "" ? allowUntyped : usesLaminatorLineFieldsCreate(selectedType);
  const showSimpleProfile = selectedType != null && usesSimpleEquipmentProfile(selectedType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!allowUntyped && machineTypeId.trim() === "") {
        setError("Select a machine type.");
        return;
      }
      const typeId = machineTypeId.trim() === "" ? null : machineTypeId.trim();
      const body: Record<string, unknown> = {
        name: name.trim(),
        machineTypeId: typeId,
        hourlyRate: Number(hourlyRate || 0),
        laborHourlyRate: Number(laborHourlyRate || 0),
        technicalSpecs: {},
      };

      if (isCutterProfile) {
        body.spoilagePercent = Number(spoilagePercent || 0);
        body.pricePerCut = Number(pricePerCut || 0);
        body.cutterMaxHeightInches =
          cutterMaxHeightInches.trim() === "" ? null : Number(cutterMaxHeightInches);
        body.cutterMaxWeight = cutterMaxWeight.trim() === "" ? null : Number(cutterMaxWeight);
        body.cutterOversizeMinLongEdgeInches =
          cutterOversizeMinLongEdgeInches.trim() === ""
            ? null
            : Number(cutterOversizeMinLongEdgeInches);
        body.cutterOversizeMaxLiftHeightInches =
          cutterOversizeMaxLiftHeightInches.trim() === ""
            ? null
            : Number(cutterOversizeMaxLiftHeightInches);
        body.cutterHelperLaborHourlyRate =
          cutterHelperLaborHourlyRate.trim() === ""
            ? null
            : Number(cutterHelperLaborHourlyRate);
        body.cutterBaseSetupHours = Number(cutterBaseSetupHours || 0);
        body.cutterBuildLiftHours = Number(cutterBuildLiftHours || 0);
        body.cutterAdditionalSetupHoursPerCut = Number(cutterAdditionalSetupHoursPerCut || 0);
        body.cutterPerCutHours = Number(cutterPerCutHours || 0);
        body.cutterMakeReadySpoilagePercent =
          cutterMakeReadySpoilagePercent.trim() === ""
            ? null
            : Number(cutterMakeReadySpoilagePercent);
        body.cutterMinCutsEnabled = cutterMinCutsEnabled;
      } else if (showSimpleProfile) {
        body.maxWidthInches = Number(maxWidthInches || 100);
        body.maxSpeedMetersMin = Number(maxSpeedMetersMin || 1);
        body.makeReadyMinutes = 0;
        body.extraMakeReadyDigitalMinutes = 0;
        body.extraMakeReadyOffsetMinutes = 0;
        body.sideChangeMinutes = 0;
        body.washUpMinutes = 0;
        body.spoilagePercent = 0;
        body.pricePerCut = 0;
      } else if (showLineFields) {
        body.maxWidthInches = Number(maxWidthInches);
        body.maxSpeedMetersMin = Number(maxSpeedMetersMin);
        body.makeReadyMinutes = Number(makeReadyMinutes || 0);
        body.extraMakeReadyDigitalMinutes = Number(extraMakeReadyDigitalMinutes || 0);
        body.extraMakeReadyOffsetMinutes = Number(extraMakeReadyOffsetMinutes || 0);
        body.sideChangeMinutes = Number(sideChangeMinutes || 0);
        body.washUpMinutes = Number(washUpMinutes || 0);
        body.spoilagePercent = Number(spoilagePercent || 0);
        body.pricePerCut = Number(pricePerCut || 0);
      }

      const res = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create");
        return;
      }
      if (data.id) {
        router.push(`/machines/${data.id}`);
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      aria-label={estimatingSection ? `Add ${estimatingSection} machine` : "Add machine"}
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-medium text-zinc-900">New machine</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {isCutterProfile
          ? "Cutter profile: times in hours, run spoilage %, and per-cut price. Hourly rates apply if you cost labor separately."
          : showSimpleProfile
            ? "Finishing (non-cutter) or mailing: hourly rates and notes. Line fields use safe placeholders until you refine the record."
            : "Line equipment: web width, speed, and make ready. Add reduction and spoilage rules after saving."}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder={
              isCutterProfile ? "e.g. Polar cutter" : "e.g. GBC Titan 165 / Heidelberg XL"
            }
          />
        </label>
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Machine type
          </span>
          <select
            required={!allowUntyped}
            value={machineTypeId}
            onChange={(e) => setMachineTypeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {allowUntyped ? <option value="">— None (laminator line) —</option> : null}
            {machineTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {formatMachineTypeOptionLabel(t)}
              </option>
            ))}
          </select>
        </label>

        {isCutterProfile ? (
          <>
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
              />
            </label>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Oversize — long edge from (in), optional
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={cutterOversizeMinLongEdgeInches}
                onChange={(e) => setCutterOversizeMinLongEdgeInches(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                placeholder="Apply smaller lift / helper rate at or above this"
              />
            </label>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Oversize — max lift height (in), optional
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={cutterOversizeMaxLiftHeightInches}
                onChange={(e) => setCutterOversizeMaxLiftHeightInches(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Oversize — helper labor $/hr, optional
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={cutterHelperLaborHourlyRate}
                onChange={(e) => setCutterHelperLaborHourlyRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
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
            </label>
            <label className="flex cursor-pointer items-center gap-2 sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={cutterMinCutsEnabled}
                onChange={(e) => setCutterMinCutsEnabled(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span className="text-sm text-zinc-800">Min cuts</span>
            </label>
          </>
        ) : showSimpleProfile ? (
          <p className="text-xs text-zinc-600 sm:col-span-2 lg:col-span-3">
            Width and speed defaults (100 in × 1 m/min) are stored for database compatibility. Edit
            technical specs JSON on the machine page for equipment-specific details.
          </p>
        ) : (
          <>
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
              <p className="mt-1 text-[11px] text-zinc-500">
                Added for Digital jobs on top of base make ready.
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
                Default spoilage (%)
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
              <p className="mt-1 text-[11px] text-zinc-500">
                Quantity bands on the machine edit page after you create it.
              </p>
            </label>
          </>
        )}

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
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create & edit details"}
      </button>
    </form>
  );
}
