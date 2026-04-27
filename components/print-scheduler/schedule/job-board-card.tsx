"use client";

import { Button } from "@/components/print-scheduler/ui/button";
import type { CalendarEventBlock } from "@/types/calendar";
import { cn } from "@/lib/print-scheduler/utils";
import { useDraggable } from "@dnd-kit/core";
import confetti from "canvas-confetti";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export type JobBoardCardProps = {
  event: CalendarEventBlock;
  isOperatorActive: boolean;
  operatorName?: string | null;
  realtimeEnabled: boolean;
  liftStyle?: boolean;
  /** When true, card is not draggable (no DnD context required). */
  readOnly?: boolean;
  /** Digital print operator “Log in” row; hide for laminating. */
  showOperatorControls?: boolean;
  onOpenDetail: (jobId: string) => void;
  onOperatorToggle: (jobId: string, nextActive: boolean) => void;
};

function appleConfetti() {
  void confetti({
    particleCount: 55,
    spread: 54,
    startVelocity: 28,
    ticks: 200,
    gravity: 0.92,
    scalar: 0.92,
    origin: { x: 0.5, y: 0.62 },
    colors: ["#38bdf8", "#0ea5e9", "#6366f1", "#7dd3fc", "#c4b5fd"],
  });
}

type CardBodyProps = Omit<
  JobBoardCardProps,
  "readOnly" | "liftStyle"
> & {
  liftStyle?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
  dragHandle?: ReactNode;
  cursorGrab: boolean;
};

function JobBoardCardBody({
  event,
  isOperatorActive,
  operatorName,
  realtimeEnabled,
  liftStyle,
  setNodeRef,
  style,
  isDragging,
  dragHandle,
  cursorGrab,
  showOperatorControls = true,
  onOpenDetail,
  onOperatorToggle,
}: CardBodyProps) {
  const subtitle = event.extendedProps.subtitle?.trim();
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex min-h-[3.25rem] flex-col gap-1 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight shadow-sm transition-[box-shadow,opacity,transform]",
        isOperatorActive
          ? "border-sky-500 bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25"
          : "border-slate-200/90 bg-white/95 text-slate-800",
        isDragging && "z-40 opacity-70 shadow-xl ring-1 ring-slate-200/80",
        liftStyle && "shadow-xl opacity-90",
        cursorGrab ? "cursor-grab active:cursor-grabbing" : "cursor-default",
      )}
    >
      <div className="flex items-start gap-0.5">
        {dragHandle}
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 text-left font-medium",
            isOperatorActive ? "text-white" : "text-slate-900",
          )}
          onClick={() => onOpenDetail(event.id)}
        >
          {event.title}
        </button>
      </div>
      {subtitle ? (
        <p
          className={cn(
            "line-clamp-2 pl-4 text-[10px] leading-snug",
            isOperatorActive ? "text-sky-100/95" : "text-slate-500",
          )}
        >
          {subtitle}
        </p>
      ) : null}
      {showOperatorControls ? (
      <div className="flex flex-wrap items-center gap-1 pl-4">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={cn(
            "h-6 rounded-md px-2 text-[10px]",
            isOperatorActive &&
              "border-white/30 bg-white/20 text-white hover:bg-white/30 dark:bg-white/15",
            !isOperatorActive && "bg-sky-50 text-sky-800 hover:bg-sky-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            const next = !isOperatorActive;
            if (next) appleConfetti();
            onOperatorToggle(event.id, next);
          }}
        >
          {isOperatorActive ? "End session" : "Log in"}
        </Button>
        {isOperatorActive && operatorName ? (
          <span className={cn("text-[10px]", isOperatorActive ? "text-sky-100" : "text-slate-500")}>
            {operatorName}
          </span>
        ) : null}
        {!realtimeEnabled ? (
          <span className="text-[9px] text-amber-700/90">Live sync off</span>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function JobBoardCardDraggable(props: Omit<JobBoardCardProps, "readOnly">) {
  const {
    event,
    isOperatorActive,
    operatorName,
    realtimeEnabled,
    liftStyle,
    showOperatorControls = true,
    onOpenDetail,
    onOperatorToggle,
  } = props;
  const runningOrPaused =
    event.extendedProps.status === "running" || event.extendedProps.status === "paused";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${event.id}`,
    data: { type: "job", event },
    disabled: runningOrPaused,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  const dragHandle = !runningOrPaused ? (
    <button
      type="button"
      className="mt-0.5 shrink-0 touch-none text-slate-400 hover:text-slate-600"
      aria-label="Drag to reschedule"
      {...listeners}
      {...attributes}
    >
      <GripVertical className="size-3.5" />
    </button>
  ) : null;

  return (
    <JobBoardCardBody
      event={event}
      isOperatorActive={isOperatorActive}
      operatorName={operatorName}
      realtimeEnabled={realtimeEnabled}
      liftStyle={liftStyle}
      showOperatorControls={showOperatorControls}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      dragHandle={dragHandle}
      cursorGrab={!runningOrPaused}
      onOpenDetail={onOpenDetail}
      onOperatorToggle={onOperatorToggle}
    />
  );
}

export function JobBoardCard({ readOnly = false, ...props }: JobBoardCardProps) {
  if (readOnly) {
    const {
      event,
      isOperatorActive,
      operatorName,
      realtimeEnabled,
      showOperatorControls = true,
      onOpenDetail,
      onOperatorToggle,
    } = props;
    return (
      <JobBoardCardBody
        event={event}
        isOperatorActive={isOperatorActive}
        operatorName={operatorName}
        realtimeEnabled={realtimeEnabled}
        showOperatorControls={showOperatorControls}
        dragHandle={null}
        cursorGrab={false}
        onOpenDetail={onOpenDetail}
        onOperatorToggle={onOperatorToggle}
      />
    );
  }
  return <JobBoardCardDraggable {...props} />;
}

export function JobBoardCardDragOverlay({
  event,
  isOperatorActive,
}: Pick<JobBoardCardProps, "event" | "isOperatorActive">) {
  return (
    <div
      className={cn(
        "flex min-h-[3.25rem] min-w-[140px] flex-col gap-1 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight opacity-70 shadow-xl",
        isOperatorActive
          ? "border-sky-400 bg-gradient-to-br from-sky-500 to-blue-600 text-white"
          : "border-slate-200 bg-white text-slate-900",
      )}
    >
      <p className="font-medium">{event.title}</p>
      <span className="text-[10px] opacity-80">Moving…</span>
    </div>
  );
}
