"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JobShippingEditor({
  jobId,
  initialShippingInstructions,
  readOnly,
}: {
  jobId: string;
  initialShippingInstructions: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialShippingInstructions ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/job-tickets/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingInstructions: text.trim() === "" ? null : text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      setNotice("Saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-600">
        Ship-to address, carrier, service level, delivery window, dock / lift gate, skid count, and
        other outbound notes. Copied from the quote when the job was created — edit here as plans
        change.
      </p>
      <label className="sr-only" htmlFor="job-shipping-instructions">
        Shipping information
      </label>
      <textarea
        id="job-shipping-instructions"
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
        rows={7}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-600"
        placeholder="Ship-to name and address, carrier preference, tracking when shipped, internal notes…"
      />
      {readOnly ? (
        <p className="text-xs font-medium text-amber-900/80">Read-only — this job is complete and locked.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save shipping"}
          </button>
          {notice ? <span className="text-sm text-emerald-800">{notice}</span> : null}
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>
      )}
    </div>
  );
}
