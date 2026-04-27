import type { Prisma } from "@prisma/client";

/** Normalize API/client input into a flat string map stored as JSON on Company / JobTicket. */
export function parseCustomFieldsInput(raw: unknown): Prisma.InputJsonValue | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("customFields must be a JSON object");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim();
    if (!key) continue;
    if (v === null || v === undefined) continue;
    out[key] = String(v);
  }
  return out as Prisma.InputJsonValue;
}

export function customFieldsToEntries(value: Prisma.JsonValue | null | undefined): Array<{
  key: string;
  value: string;
}> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return [];
  const entries: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      entries.push({ key: k, value: String(v) });
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}
