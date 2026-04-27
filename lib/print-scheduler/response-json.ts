import { schedulerLoginRedirectUrl } from "@/lib/print-scheduler/paths";

/**
 * Read `fetch` response body as JSON with clear errors when the body is empty or not JSON.
 */
export async function readResponseJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (!res.ok) {
      throw new Error(
        `Server returned ${res.status} with an empty body. Check the API terminal logs. For local dev use DATABASE_URL="file:./dev.db", then npx prisma db push && npx prisma db seed`,
      );
    }
    throw new Error("Server returned an empty body.");
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Expected JSON from server (${res.status}) but could not parse it. First bytes: ${trimmed.slice(0, 120)}${trimmed.length > 120 ? "…" : ""}`,
    );
  }
}

export async function readOkJson<T = unknown>(res: Response): Promise<T> {
  const data = await readResponseJson<T>(res);
  if (!res.ok) {
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const err = obj?.error != null ? String(obj.error) : `Request failed (${res.status})`;
    const hint = obj?.hint != null ? ` ${String(obj.hint)}` : "";
    throw new Error(err + hint);
  }
  return data;
}

/** For browser `fetch`: redirect to login when the session is missing or invalid. */
export async function readOkJsonWithAuth<T = unknown>(res: Response): Promise<T> {
  if (typeof window !== "undefined" && res.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.href = schedulerLoginRedirectUrl(next);
    throw new Error("Unauthorized");
  }
  return readOkJson<T>(res);
}
