/** Browser pathname prefix for the digital print scheduler UI. */
export const SCHEDULER_BASE_PATH = "/schedule/digital-print";

/** All scheduler HTTP APIs live under this prefix. */
export const SCHEDULER_API_BASE = "/api/print-scheduler";

/** e.g. schedApi("jobs") -> "/api/print-scheduler/jobs" */
export function schedApi(segment: string): string {
  const s = segment.startsWith("/") ? segment.slice(1) : segment;
  return `${SCHEDULER_API_BASE}/${s}`;
}

export function schedulerLoginRedirectUrl(navigateTo: string): string {
  return `${SCHEDULER_BASE_PATH}/login?next=${encodeURIComponent(navigateTo)}`;
}
