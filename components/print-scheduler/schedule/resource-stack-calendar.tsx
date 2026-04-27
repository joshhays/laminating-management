"use client";

import type { EventClickArg } from "@fullcalendar/core";
import type { EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import scrollGridPlugin from "@fullcalendar/scrollgrid";
import FullCalendar from "@fullcalendar/react";
import { useEffect, useRef } from "react";

import type { CalendarEventBlock } from "@/types/calendar";

export type MachineResource = { id: string; title: string };

export type OnEventScheduleChange = (payload: {
  jobId: string;
  startTime: string;
  endTime: string;
  resourceId: string | null;
  /** When moving to another press, server recomputes block length from that press’s speed matrix / sheets-hr. */
  recalculateEndFromPressSpeed?: boolean;
}) => Promise<void>;

export type ResourceStackCalendarProps = {
  resources: MachineResource[];
  events: CalendarEventBlock[];
  highlightEventId?: string | null;
  onEventDrop: OnEventScheduleChange;
  onEventClick?: (jobId: string) => void;
};

function toIso(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function ResourceStackCalendar({
  resources,
  events,
  highlightEventId,
  onEventDrop,
  onEventClick,
}: ResourceStackCalendarProps) {
  const highlightRef = useRef<string | null>(null);
  useEffect(() => {
    highlightRef.current = highlightEventId ?? null;
  }, [highlightEventId]);

  const persist = async (info: EventDropArg | EventResizeDoneArg) => {
    const ev = info.event;
    const start = ev.start;
    let end = ev.end;
    if (start && !end) {
      const os = info.oldEvent.start;
      const oe = info.oldEvent.end;
      if (os && oe) {
        end = new Date(start.getTime() + (oe.getTime() - os.getTime()));
      }
    }
    const startIso = toIso(start ?? null);
    const endIso = toIso(end ?? null);
    if (!startIso || !endIso) {
      info.revert();
      return;
    }
    const resourceId = ev.getResources()[0]?.id ?? null;
    const oldResourceId = info.oldEvent.getResources()[0]?.id ?? null;
    const machineChanged =
      oldResourceId != null && resourceId != null && oldResourceId !== resourceId;
    try {
      await onEventDrop({
        jobId: ev.id,
        startTime: startIso,
        endTime: endIso,
        resourceId,
        recalculateEndFromPressSpeed: machineChanged,
      });
    } catch {
      info.revert();
    }
  };

  const handleClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    onEventClick?.(info.event.id);
  };

  const fcEvents = events.map((e) => ({
    id: e.id,
    resourceId: e.resourceId,
    title: e.title,
    start: e.start,
    end: e.end,
    backgroundColor: e.color,
    borderColor: e.color,
    extendedProps: e.extendedProps,
    textColor: "#fafafa",
    classNames: ["rounded-md", "shadow-sm", "border-0", "text-[11px]", "leading-tight", "font-medium"],
  }));

  return (
    <div className="resource-stack-cal overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <FullCalendar
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        plugins={[scrollGridPlugin, resourceTimeGridPlugin, interactionPlugin]}
        initialView="resourceTimeGridWeek"
        timeZone="local"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "resourceTimeGridDay,resourceTimeGridWeek",
        }}
        resourceAreaHeaderContent="Machines"
        resourceAreaWidth="14%"
        resources={resources}
        events={fcEvents}
        editable
        eventDurationEditable
        eventStartEditable
        eventResourceEditable
        selectable={false}
        nowIndicator
        allDaySlot={false}
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        slotMinTime="06:00:00"
        slotMaxTime="21:00:00"
        scrollTime="07:00:00"
        slotEventOverlap
        eventMaxStack={5}
        dayMinWidth={140}
        height="72vh"
        eventClick={onEventClick ? handleClick : undefined}
        eventDrop={persist}
        eventResize={persist}
        eventAllow={(_span, movingEvent) => {
          if (!movingEvent) return true;
          const raw = (movingEvent.extendedProps as { status?: string } | undefined)?.status;
          const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
          return (
            s !== "running" &&
            s !== "paused" &&
            s !== "completed" &&
            s !== "cancelled"
          );
        }}
        eventDidMount={(info) => {
          const id = highlightRef.current;
          if (id && info.event.id === id) {
            info.el.classList.add(
              "!ring-2",
              "!ring-zinc-900",
              "dark:!ring-zinc-100",
              "!ring-offset-2",
              "!ring-offset-white",
              "dark:!ring-offset-zinc-950",
            );
            window.setTimeout(() => {
              info.el.classList.remove(
                "!ring-2",
                "!ring-zinc-900",
                "dark:!ring-zinc-100",
                "!ring-offset-2",
                "!ring-offset-white",
                "dark:!ring-offset-zinc-950",
              );
            }, 1600);
          }
        }}
      />
    </div>
  );
}
