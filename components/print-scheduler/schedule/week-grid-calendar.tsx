"use client";

import { Button } from "@/components/print-scheduler/ui/button";
import type { MachineResource, OnEventScheduleChange } from "@/components/print-scheduler/schedule/resource-stack-calendar";
import { JobBoardCard, JobBoardCardDragOverlay } from "@/components/print-scheduler/schedule/job-board-card";
import type { CalendarEventBlock } from "@/types/calendar";
import { cn } from "@/lib/print-scheduler/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const SLOT_START = 6;
const SLOT_END = 21;
const HOUR_PX = 44;
const COLUMN_BODY_H = (SLOT_END - SLOT_START) * HOUR_PX;

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayIndexInWeek(weekStart: Date, inst: Date): number {
  const a = new Date(weekStart);
  a.setHours(0, 0, 0, 0);
  const b = new Date(inst);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

type WeekGridCalendarProps = {
  resources: MachineResource[];
  events: CalendarEventBlock[];
  highlightEventId?: string | null;
  onEventDrop: OnEventScheduleChange;
  onEventClick?: (jobId: string) => void;
  operatorActiveByJobId: Record<string, boolean>;
  operatorName?: string | null;
  realtimeEnabled: boolean;
  onOperatorToggle: (jobId: string, nextActive: boolean) => void;
  /** View-only: no drag-and-drop (must be used outside `DndContext`). */
  readOnly?: boolean;
  /** Left column header above machine names (default “Press”). */
  machineColumnTitle?: string;
  /** Digital print operator row on each card (default true). */
  showOperatorControlsOnCards?: boolean;
  /** Controlled week index (0 = this week). Pair with `onWeekOffsetChange` to sync data loading. */
  weekOffset?: number;
  onWeekOffsetChange?: (next: number) => void;
};

function StaticGridCell({ children }: { children: ReactNode }) {
  return (
    <div className="relative border-l border-slate-200 bg-slate-50/50" style={{ minHeight: COLUMN_BODY_H }}>
      <div
        className="pointer-events-none absolute inset-0 flex flex-col"
        aria-hidden
      >
        {Array.from({ length: SLOT_END - SLOT_START }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 border-b border-slate-100"
            style={{ height: HOUR_PX }}
          />
        ))}
      </div>
      <div className="relative z-[1] p-1">{children}</div>
    </div>
  );
}

function DroppableCell({
  machineSlug,
  dayIdx,
  children,
}: {
  machineSlug: string;
  dayIdx: number;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `drop-${machineSlug}-${dayIdx}`,
    data: { machineSlug, dayIdx },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-l border-slate-200 bg-slate-50/50",
        isOver &&
          "z-10 ring-2 ring-inset ring-sky-400/70 ring-offset-0 ring-offset-transparent outline-dashed outline-2 -outline-offset-2 outline-sky-300/80 bg-sky-50/40",
      )}
      style={{ minHeight: COLUMN_BODY_H }}
    >
      <div
        className="pointer-events-none absolute inset-0 flex flex-col"
        aria-hidden
      >
        {Array.from({ length: SLOT_END - SLOT_START }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 border-b border-slate-100"
            style={{ height: HOUR_PX }}
          />
        ))}
      </div>
      <div className="relative z-[1] p-1">{children}</div>
    </div>
  );
}

export function WeekGridCalendar({
  resources,
  events,
  highlightEventId,
  onEventDrop,
  onEventClick,
  operatorActiveByJobId,
  operatorName,
  realtimeEnabled,
  onOperatorToggle,
  readOnly = false,
  machineColumnTitle = "Press",
  showOperatorControlsOnCards = true,
  weekOffset: weekOffsetControlled,
  onWeekOffsetChange,
}: WeekGridCalendarProps) {
  const [mounted, setMounted] = useState(false);
  const [internalWeekOffset, setInternalWeekOffset] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  const weekOffsetControlledMode = weekOffsetControlled !== undefined;
  const weekOffset = weekOffsetControlledMode ? weekOffsetControlled! : internalWeekOffset;

  function setWeekOffset(next: number | ((prev: number) => number)) {
    if (weekOffsetControlledMode) {
      const resolved = typeof next === "function" ? next(weekOffset) : next;
      onWeekOffsetChange?.(resolved);
    } else {
      setInternalWeekOffset((prev) => (typeof next === "function" ? next(prev) : next));
    }
  }

  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
  );

  const weekStart = useMemo(() => {
    const a = new Date();
    a.setDate(a.getDate() + weekOffset * 7);
    return startOfWeekMonday(a);
  }, [weekOffset]);

  const dayDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const eventsByMachineDay = useMemo(() => {
    const map = new Map<string, CalendarEventBlock[]>();
    for (const ev of events) {
      const start = new Date(ev.start);
      const di = dayIndexInWeek(weekStart, start);
      if (di < 0 || di > 6) continue;
      const key = `${ev.resourceId}:${di}`;
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    return map;
  }, [events, weekStart]);

  function layoutJob(ev: CalendarEventBlock): { top: number; height: number } {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    let h = start.getHours() + start.getMinutes() / 60;
    const he = end.getHours() + end.getMinutes() / 60;
    if (he <= h) {
      const dMs = Math.max(end.getTime() - start.getTime(), 15 * 60_000);
      h = Math.max(SLOT_START, Math.min(SLOT_END - 0.25, h));
      return {
        top: (h - SLOT_START) * HOUR_PX,
        height: Math.max(28, (dMs / 3_600_000) * HOUR_PX),
      };
    }
    const top = Math.max(0, (h - SLOT_START) * HOUR_PX);
    const bottom = Math.min(COLUMN_BODY_H, (he - SLOT_START) * HOUR_PX);
    return { top, height: Math.max(28, bottom - top) };
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over?.data.current || !active.data.current) return;
    const job = active.data.current as { type?: string; event?: CalendarEventBlock };
    if (job.type !== "job" || !job.event) return;
    const drop = over.data.current as { machineSlug?: string; dayIdx?: number };
    if (drop.machineSlug == null || drop.dayIdx == null) return;

    const ev = job.event;
    const oldStart = new Date(ev.start);
    const oldEnd = new Date(ev.end);
    const dur = Math.max(15 * 60_000, oldEnd.getTime() - oldStart.getTime());

    const targetDay = addDays(weekStart, drop.dayIdx);
    const newStart = new Date(targetDay);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds(), 0);
    const newEnd = new Date(newStart.getTime() + dur);
    const machineChanged = ev.resourceId !== drop.machineSlug;

    try {
      await onEventDrop({
        jobId: ev.id,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        resourceId: drop.machineSlug,
        recalculateEndFromPressSpeed: machineChanged,
      });
    } catch {
      /* parent toasts */
    }
  }

  const activeEvent = activeId
    ? events.find((e) => `job-${e.id}` === activeId) ?? null
    : null;

  const rangeLabel = `${dayDates[0]!.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${dayDates[6]!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const gridInner = (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2"
              onClick={() => setWeekOffset((o) => o - 1)}
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2"
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
          </div>
          <p className="text-sm font-medium text-slate-700">{rangeLabel}</p>
        </div>

        <div
          className="sticky top-0 z-30 grid border-b border-slate-200 bg-slate-50/75 backdrop-blur-md"
          style={{ gridTemplateColumns: `10rem repeat(7, minmax(0, 1fr))` }}
        >
          <div className="sticky left-0 z-40 border-r border-slate-200 bg-slate-50/85 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-md">
            {machineColumnTitle}
          </div>
          {dayDates.map((d, i) => (
            <div
              key={i}
              className={cn(
                "border-l border-slate-200 px-2 py-2 text-center",
                sameLocalDay(d, new Date()) && "bg-sky-50/80",
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>

        <div className="max-h-[min(78vh,900px)] overflow-y-auto">
          {resources.map((res) => (
            <div
              key={res.id}
              className="grid border-b border-slate-200"
              style={{ gridTemplateColumns: `10rem repeat(7, minmax(0, 1fr))` }}
            >
              <div
                className={cn(
                  "sticky left-0 z-20 flex items-start border-r border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800",
                )}
              >
                {res.title}
              </div>
              {dayDates.map((d, dayIdx) => {
                const key = `${res.id}:${dayIdx}`;
                const list = eventsByMachineDay.get(key) ?? [];
                const cellBody = (
                  <div className="relative" style={{ minHeight: COLUMN_BODY_H - 8 }}>
                    {list.map((ev) => {
                      const { top, height } = layoutJob(ev);
                      const isOp = Boolean(operatorActiveByJobId[ev.id]);
                      return (
                        <div
                          key={ev.id}
                          className={cn(
                            "absolute left-0 right-0 px-0.5",
                            highlightEventId === ev.id &&
                              "z-20 rounded-lg ring-2 ring-slate-900 ring-offset-1 ring-offset-slate-50",
                          )}
                          style={{ top, height }}
                        >
                          <JobBoardCard
                            event={ev}
                            isOperatorActive={isOp}
                            operatorName={operatorName}
                            realtimeEnabled={realtimeEnabled}
                            readOnly={readOnly}
                            showOperatorControls={showOperatorControlsOnCards}
                            onOpenDetail={(id) => onEventClick?.(id)}
                            onOperatorToggle={onOperatorToggle}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
                return readOnly ? (
                  <StaticGridCell key={key}>{cellBody}</StaticGridCell>
                ) : (
                  <DroppableCell key={key} machineSlug={res.id} dayIdx={dayIdx}>
                    {cellBody}
                  </DroppableCell>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (!mounted) {
    return (
      <div
        className="min-h-[min(78vh,900px)] rounded-xl border border-slate-200 bg-slate-50 animate-pulse"
        aria-busy="true"
        aria-label="Loading schedule grid"
      />
    );
  }

  if (readOnly) {
    return gridInner;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {gridInner}
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.25,1,0.5,1)" }}>
        {activeEvent ? (
          <JobBoardCardDragOverlay
            event={activeEvent}
            isOperatorActive={Boolean(operatorActiveByJobId[activeEvent.id])}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
