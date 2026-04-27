"use client";

import type { MachineType } from "@prisma/client";
import { MachineTypeKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { EstimatingEquipmentSection } from "@/lib/estimating-equipment-filters";
import { machineTypeMatchesSection } from "@/lib/estimating-equipment-filters";
import { formatMachineTypeOptionLabel } from "@/lib/machine-type-labels";

type Variant = EstimatingEquipmentSection | undefined;

type PressTechForm = "OFFSET" | "TONER" | "INKJET";
type FinishingKindForm = "CUTTER" | "FOLDER" | "BINDER" | "OTHER";

function typeListLabel(t: MachineType) {
  return formatMachineTypeOptionLabel(t);
}

export function MachineTypesSection({
  initial,
  variant,
}: {
  initial: MachineType[];
  variant?: Variant;
}) {
  const router = useRouter();
  const visible = useMemo(
    () =>
      variant ? initial.filter((t) => machineTypeMatchesSection(t, variant)) : initial,
    [initial, variant],
  );
  const [types, setTypes] = useState(visible);

  useEffect(() => {
    setTypes(visible);
  }, [visible]);

  const [name, setName] = useState("");
  const [pressTechnology, setPressTechnology] = useState<PressTechForm>("OFFSET");
  const [finishingKind, setFinishingKind] = useState<FinishingKindForm>("CUTTER");
  const [legacyCutterType, setLegacyCutterType] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Name is required");
        return;
      }

      let body: Record<string, unknown>;

      if (variant === "press") {
        body = {
          name: trimmed,
          kind: MachineTypeKind.PRESS,
          pressTechnology,
        };
      } else if (variant === "finishing") {
        if (legacyCutterType) {
          body = { name: trimmed, kind: MachineTypeKind.CUTTER };
        } else {
          body = {
            name: trimmed,
            kind: MachineTypeKind.FINISHING,
            finishingKind,
          };
        }
      } else if (variant === "mailing") {
        body = { name: trimmed, kind: MachineTypeKind.MAILING };
      } else {
        body = { name: trimmed, kind: MachineTypeKind.LAMINATOR };
      }

      const res = await fetch("/api/machine-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as MachineType & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create");
        return;
      }
      if (data.id) {
        setTypes((prev) =>
          [...prev.filter((x) => x.id !== data.id), data].sort((a, b) =>
            a.sortOrder !== b.sortOrder
              ? a.sortOrder - b.sortOrder
              : a.name.localeCompare(b.name),
          ),
        );
        setName("");
        setLegacyCutterType(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeType(id: string) {
    if (!confirm("Delete this machine type? Machines using it will be unlinked.")) return;
    const res = await fetch(`/api/machine-types/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete");
      return;
    }
    setTypes((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  const sectionTitle =
    variant === "press"
      ? "Press type templates"
      : variant === "laminating"
        ? "Laminator type templates"
        : variant === "finishing"
          ? "Finishing type templates"
          : variant === "mailing"
            ? "Mailing type templates"
            : "Machine types";

  const sectionBlurb =
    variant === "press"
      ? "Each type is a press family plus technology (offset, toner, or inkjet). Technology drives which estimating fields and technical specs you will use on each machine."
      : variant === "laminating"
        ? "Tag laminators (thermal line, UV coater, etc.). Same web-width and speed-rule model as film estimates."
        : variant === "finishing"
          ? "Cutters with subtype Cutter feed trim-time estimates. Folders, binders, and other finishing types are stored for rates and future costing."
          : variant === "mailing"
            ? "Inserting, addressing, and mail-prep lines for estimating setup."
            : "Labels for equipment families. Optional defaults can be filled per type in the API.";

  return (
    <section className="mb-10 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-zinc-900">{sectionTitle}</h2>
      <p className="mt-1 text-sm text-zinc-600">{sectionBlurb}</p>
      <form onSubmit={(e) => void handleAdd(e)} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[200px] flex-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              New type name
            </span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder={
                variant === "press"
                  ? "e.g. 40″ Sheetfed offset"
                  : variant === "finishing"
                    ? "e.g. Polar guillotine"
                    : "e.g. Roll laminator"
              }
            />
          </label>

          {variant === "press" && (
            <label className="block min-w-[180px]">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Technology
              </span>
              <select
                value={pressTechnology}
                onChange={(e) => setPressTechnology(e.target.value as PressTechForm)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                <option value="OFFSET">Offset</option>
                <option value="TONER">Toner (digital)</option>
                <option value="INKJET">Inkjet</option>
              </select>
            </label>
          )}

          {variant === "finishing" && (
            <>
              <label className="flex cursor-pointer items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={legacyCutterType}
                  onChange={(e) => setLegacyCutterType(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700">Legacy “Cutter” kind</span>
              </label>
              {!legacyCutterType && (
                <label className="block min-w-[180px]">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Finishing subtype
                  </span>
                  <select
                    value={finishingKind}
                    onChange={(e) => setFinishingKind(e.target.value as FinishingKindForm)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="CUTTER">Cutter</option>
                    <option value="FOLDER">Folder</option>
                    <option value="BINDER">Binder</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add type"}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {types.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
          {types.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="font-medium text-zinc-900">{typeListLabel(t)}</span>
              <button
                type="button"
                onClick={() => void removeType(t.id)}
                className="text-xs text-red-700 underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          No types in this category yet — add one to tag machines.
        </p>
      )}
    </section>
  );
}
