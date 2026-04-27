/**
 * Base URL for the main laminating app (estimates, inventory, home).
 *
 * When unset, the schedule lives in the same Next app — use `/` for internal links.
 * Set `NEXT_PUBLIC_LAMINATING_APP_URL` only if laminating is deployed on another host.
 */
export function getLaminatingAppBaseUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_LAMINATING_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "/";
}
