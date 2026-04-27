import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  value: string | number;
  hint?: string;
  trend?: string;
  trendPositive?: boolean;
  icon: LucideIcon;
  className?: string;
};

export function DashboardCard({
  title,
  value,
  hint,
  trend,
  trendPositive = true,
  icon: Icon,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--dashboard-accent)]/10 text-[var(--dashboard-accent)]">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>
      {trend ? (
        <p
          className={cn(
            "mt-2 text-sm font-medium",
            trendPositive ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {trend}
        </p>
      ) : hint ? (
        <p className="mt-2 text-sm text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
