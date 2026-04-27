/**
 * URL for the digital print schedule board (`/schedule/digital-print`).
 *
 * Set `NEXT_PUBLIC_PRINT_SCHEDULER_URL` only if you host that UI on another origin.
 */
export function getPrintSchedulerBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PRINT_SCHEDULER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "/schedule/digital-print";
}
