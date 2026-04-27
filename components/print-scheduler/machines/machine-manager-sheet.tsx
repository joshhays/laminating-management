"use client";

import { Button } from "@/components/print-scheduler/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/print-scheduler/ui/sheet";
import { defaultVersant4100MatrixJson } from "@/lib/print-scheduler/digital-press-speed-matrix";
import {
  normalizePressType,
  PRESS_TYPE_DIGITAL_IPM_MATRIX,
  PRESS_TYPE_SHEETS_PER_HOUR,
  PRESS_TYPE_TONER,
} from "@/lib/print-scheduler/press-speed";
import { schedApi } from "@/lib/print-scheduler/paths";
import { readOkJsonWithAuth } from "@/lib/print-scheduler/response-json";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type MachineDto = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  pressType: string;
  speedSheetsPerHour: number | null;
  speedPagesPerMinute: number | null;
  speedMatrixJson: string | null;
};

export type MachineManagerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onToast: (msg: { type: "ok" | "err"; text: string }) => void;
};

function patchRow(
  rows: MachineDto[],
  id: string,
  patch: Partial<MachineDto>,
): MachineDto[] {
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function MachineManagerSheet({
  open,
  onOpenChange,
  onSaved,
  onToast,
}: MachineManagerSheetProps) {
  const [rows, setRows] = useState<MachineDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newPressType, setNewPressType] = useState<string>(PRESS_TYPE_SHEETS_PER_HOUR);
  const [newSpeedSheets, setNewSpeedSheets] = useState("3000");
  const [newSpeedPpm, setNewSpeedPpm] = useState("120");
  const [newSpeedMatrixJson, setNewSpeedMatrixJson] = useState(() =>
    defaultVersant4100MatrixJson(),
  );
  const [newOrder, setNewOrder] = useState("99");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(schedApi("machines"));
      const list = await readOkJsonWithAuth<MachineDto[]>(res);
      setRows(
        list.map((r) => ({
          ...r,
          pressType: normalizePressType(r.pressType),
          speedMatrixJson: r.speedMatrixJson ?? null,
        })),
      );
    } catch (e) {
      onToast({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load machines",
      });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function saveRow(m: MachineDto) {
    try {
      const res = await fetch(schedApi(`machines/${m.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: m.name,
          sortOrder: m.sortOrder,
          pressType: m.pressType,
          speedSheetsPerHour:
            m.pressType === PRESS_TYPE_SHEETS_PER_HOUR
              ? m.speedSheetsPerHour === null
                ? null
                : Number(m.speedSheetsPerHour)
              : null,
          speedPagesPerMinute:
            m.pressType === PRESS_TYPE_TONER
              ? m.speedPagesPerMinute === null
                ? null
                : Number(m.speedPagesPerMinute)
              : null,
          speedMatrixJson:
            m.pressType === PRESS_TYPE_DIGITAL_IPM_MATRIX
              ? m.speedMatrixJson?.trim() || null
              : null,
        }),
      });
      await readOkJsonWithAuth(res);
      onToast({ type: "ok", text: `Saved ${m.name}.` });
      onSaved();
      await load();
    } catch (e) {
      onToast({
        type: "err",
        text: e instanceof Error ? e.message : "Save failed",
      });
    }
  }

  async function addMachine() {
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const name = newName.trim();
    if (!slug || !name) {
      onToast({ type: "err", text: "Name and slug (letters, numbers, underscores) are required." });
      return;
    }
    setCreating(true);
    try {
      const pt = normalizePressType(newPressType);
      const res = await fetch(schedApi("machines"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          sortOrder: Number(newOrder) || 0,
          pressType: pt,
          speedSheetsPerHour:
            pt === PRESS_TYPE_SHEETS_PER_HOUR
              ? Number(newSpeedSheets) > 0
                ? Number(newSpeedSheets)
                : null
              : null,
          speedPagesPerMinute:
            pt === PRESS_TYPE_TONER
              ? Number(newSpeedPpm) > 0
                ? Number(newSpeedPpm)
                : null
              : null,
          speedMatrixJson:
            pt === PRESS_TYPE_DIGITAL_IPM_MATRIX
              ? newSpeedMatrixJson.trim() || null
              : null,
        }),
      });
      await readOkJsonWithAuth(res);
      onToast({ type: "ok", text: `Added ${name}.` });
      setNewSlug("");
      setNewName("");
      setNewPressType(PRESS_TYPE_SHEETS_PER_HOUR);
      setNewSpeedSheets("3000");
      setNewSpeedPpm("120");
      setNewSpeedMatrixJson(defaultVersant4100MatrixJson());
      setNewOrder("99");
      onSaved();
      await load();
    } catch (e) {
      onToast({
        type: "err",
        text: e instanceof Error ? e.message : "Create failed",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-zinc-100 px-6 pb-4 dark:border-zinc-900">
          <SheetTitle>Machines & press speed</SheetTitle>
          <SheetDescription>
            Sheet-fed: sheets/hour. Toner: letter ppm (×60 as sheets/hr). Digital IPM matrix: JSON
            rules for SMALL/LARGE sheet, SIMPLEX/DUPLEX, GSM bands → impressions per minute (run time =
            impressions ÷ IPM).
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="space-y-4">
              {rows.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <p className="mb-2 font-mono text-[11px] text-zinc-500">{m.slug}</p>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Name</label>
                  <input
                    value={m.name}
                    onChange={(e) => setRows((prev) => patchRow(prev, m.id, { name: e.target.value }))}
                    className="mb-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <div className="mb-2">
                    <label className="mb-1 block text-xs font-medium text-zinc-500">Press type</label>
                    <select
                      value={normalizePressType(m.pressType)}
                      onChange={(e) => {
                        const pt = normalizePressType(e.target.value);
                        setRows((prev) =>
                          patchRow(prev, m.id, {
                            pressType: pt,
                            ...(pt === PRESS_TYPE_TONER
                              ? { speedSheetsPerHour: null, speedMatrixJson: null }
                              : pt === PRESS_TYPE_DIGITAL_IPM_MATRIX
                                ? {
                                    speedSheetsPerHour: null,
                                    speedPagesPerMinute: null,
                                    speedMatrixJson:
                                      m.speedMatrixJson || defaultVersant4100MatrixJson(),
                                  }
                                : { speedPagesPerMinute: null, speedMatrixJson: null }),
                          }),
                        );
                      }}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <option value={PRESS_TYPE_SHEETS_PER_HOUR}>Sheets per hour</option>
                      <option value={PRESS_TYPE_TONER}>Toner (letter ppm)</option>
                      <option value={PRESS_TYPE_DIGITAL_IPM_MATRIX}>Digital (IPM matrix)</option>
                    </select>
                  </div>
                  {normalizePressType(m.pressType) === PRESS_TYPE_DIGITAL_IPM_MATRIX ? (
                    <div className="mb-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-medium text-zinc-500">Speed matrix (JSON)</label>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setRows((prev) =>
                              patchRow(prev, m.id, {
                                speedMatrixJson: defaultVersant4100MatrixJson(),
                              }),
                            )
                          }
                        >
                          Versant 4100 template
                        </Button>
                      </div>
                      <textarea
                        value={m.speedMatrixJson ?? ""}
                        onChange={(e) =>
                          setRows((prev) =>
                            patchRow(prev, m.id, { speedMatrixJson: e.target.value || null }),
                          )
                        }
                        rows={10}
                        spellCheck={false}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[11px] leading-snug dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-500">
                            Sort order
                          </label>
                          <input
                            type="number"
                            value={m.sortOrder}
                            onChange={(e) =>
                              setRows((prev) =>
                                patchRow(prev, m.id, { sortOrder: Number(e.target.value) || 0 }),
                              )
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      {normalizePressType(m.pressType) === PRESS_TYPE_TONER ? (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-500">
                            Pages / min (8.5×11)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={m.speedPagesPerMinute ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                patchRow(prev, m.id, {
                                  speedPagesPerMinute:
                                    e.target.value === "" ? null : Number(e.target.value),
                                }),
                              )
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                            placeholder="e.g. 120"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-500">
                            Sheets / hr
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={m.speedSheetsPerHour ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                patchRow(prev, m.id, {
                                  speedSheetsPerHour:
                                    e.target.value === "" ? null : Number(e.target.value),
                                }),
                              )
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                            placeholder="e.g. 3200"
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-500">Sort order</label>
                        <input
                          type="number"
                          value={m.sortOrder}
                          onChange={(e) =>
                            setRows((prev) =>
                              patchRow(prev, m.id, { sortOrder: Number(e.target.value) || 0 }),
                            )
                          }
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                    </div>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => void saveRow(m)}
                  >
                    Save
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">Add machine</p>
            <div className="space-y-2">
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="resource id e.g. printer_04"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="mb-2">
                <label className="mb-1 block text-xs font-medium text-zinc-500">Press type</label>
                <select
                  value={newPressType}
                  onChange={(e) => setNewPressType(normalizePressType(e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value={PRESS_TYPE_SHEETS_PER_HOUR}>Sheets per hour</option>
                  <option value={PRESS_TYPE_TONER}>Toner (letter ppm)</option>
                  <option value={PRESS_TYPE_DIGITAL_IPM_MATRIX}>Digital (IPM matrix)</option>
                </select>
              </div>
              {normalizePressType(newPressType) === PRESS_TYPE_DIGITAL_IPM_MATRIX ? (
                <textarea
                  value={newSpeedMatrixJson}
                  onChange={(e) => setNewSpeedMatrixJson(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {normalizePressType(newPressType) === PRESS_TYPE_TONER ? (
                    <input
                      type="number"
                      value={newSpeedPpm}
                      onChange={(e) => setNewSpeedPpm(e.target.value)}
                      placeholder="Pages/min"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  ) : (
                    <input
                      type="number"
                      value={newSpeedSheets}
                      onChange={(e) => setNewSpeedSheets(e.target.value)}
                      placeholder="Sheets/hr"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  )}
                  <input
                    type="number"
                    value={newOrder}
                    onChange={(e) => setNewOrder(e.target.value)}
                    placeholder="Sort order"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              )}
              {normalizePressType(newPressType) === PRESS_TYPE_DIGITAL_IPM_MATRIX ? (
                <input
                  type="number"
                  value={newOrder}
                  onChange={(e) => setNewOrder(e.target.value)}
                  placeholder="Sort order"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              ) : null}
              <Button type="button" className="w-full" disabled={creating} onClick={() => void addMachine()}>
                <Plus className="size-4" />
                Add machine
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
