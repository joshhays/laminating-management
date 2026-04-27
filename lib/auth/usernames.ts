/** Canonical username for storage and login (lowercase, trimmed). */
export function normalizeSiteUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
