/** Parse strings like "3/26/26" or "4/1/26 BY NOON" (date portion only). */
export function parseUsShortDate(input: string): Date | null {
  const trimmed = input.trim();
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const month = Number(m[1]) - 1;
  const day = Number(m[2]);
  const noonish = trimmed.toUpperCase().includes("NOON") ? 12 : 12;
  const d = new Date(year, month, day, noonish, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** API JSON turns Prisma dates into ISO strings — accept both. */
export function formatUsDate(d: Date | string | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDurationMinutes(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  if (start == null || end == null || start === "" || end === "") return "—";
  const a = start instanceof Date ? start : new Date(start);
  const b = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "—";
  const m = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

/** Wall clock minus accumulated pauses (and current pause segment). */
export function formatActivePressDuration(job: {
  pressRunStartedAt: Date | string | null;
  pressRunEndedAt: Date | string | null;
  pressRunPausedAt: Date | string | null;
  pressRunTotalPausedMs: number | null;
}): string {
  const { pressRunStartedAt: startRaw, pressRunEndedAt: endRaw } = job;
  if (startRaw == null || startRaw === "") return "—";
  const start = startRaw instanceof Date ? startRaw : new Date(startRaw);
  if (Number.isNaN(start.getTime())) return "—";

  const end =
    endRaw != null && endRaw !== ""
      ? endRaw instanceof Date
        ? endRaw
        : new Date(endRaw)
      : new Date();
  if (Number.isNaN(end.getTime())) return "—";

  let pauseMs = job.pressRunTotalPausedMs ?? 0;
  const pausedAtRaw = job.pressRunPausedAt;
  if (pausedAtRaw != null && pausedAtRaw !== "" && (endRaw == null || endRaw === "")) {
    const pausedAt = pausedAtRaw instanceof Date ? pausedAtRaw : new Date(pausedAtRaw);
    if (!Number.isNaN(pausedAt.getTime())) {
      pauseMs += Math.max(0, Date.now() - pausedAt.getTime());
    }
  }

  const wallMs = Math.max(0, end.getTime() - start.getTime());
  const activeMs = Math.max(0, wallMs - pauseMs);
  const m = Math.round(activeMs / 60_000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  if (mm === 0 && activeMs > 0) return "< 1m";
  return `${mm}m`;
}
