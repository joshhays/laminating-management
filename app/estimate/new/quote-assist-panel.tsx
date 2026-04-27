"use client";

import { useState } from "react";
import type { QuoteAssistPatch } from "@/lib/quote-assist-types";

type Props = {
  onApply: (patch: QuoteAssistPatch, meta: { explanation: string; warnings?: string[] }) => void;
};

export function QuoteAssistPanel({ onApply }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastExplanation, setLastExplanation] = useState<string | null>(null);

  async function handleApply() {
    const t = text.trim();
    if (t.length < 8) {
      setLocalError("Add a bit more detail (sizes, qty, paper, film look).");
      return;
    }
    setLoading(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/estimate/quote-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = (await res.json()) as
        | {
            ok: true;
            patch: QuoteAssistPatch;
            explanation: string;
            filmMatchNote?: string;
            orientationSummary?: string;
            warnings?: string[];
          }
        | { ok: false; error: string; hints?: string[] };
      if (!res.ok || !("ok" in data) || data.ok === false) {
        const err = data as { error?: string; hints?: string[] };
        setLocalError(
          [err.error, err.hints?.length ? err.hints.join(" ") : ""].filter(Boolean).join(" "),
        );
        return;
      }
      setLastExplanation(
        [data.orientationSummary, data.explanation, data.filmMatchNote].filter(Boolean).join(" "),
      );
      onApply(data.patch, {
        explanation: data.explanation,
        warnings: data.warnings,
      });
    } catch {
      setLocalError("Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-4 sm:col-span-2">
      <h3 className="text-sm font-semibold text-indigo-950">Describe the job (plain English)</h3>
      <p className="mt-1 text-xs text-indigo-900/80">
        Example:{" "}
        <span className="font-medium">
          5000 sheets 19x25 coated gloss cover, matte 1.2 mil PET laminate, both sides, digital
        </span>
        . We compare <span className="font-medium">long-edge</span> vs{" "}
        <span className="font-medium">short-edge</span> lead when it changes cross-web width, using
        your film inventory, slit waste, and $/MSI. Say <span className="font-medium">25 inch web</span>{" "}
        or <span className="font-medium">short edge feed</span> to steer orientation.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        placeholder="What are you laminating, how many sheets, what size sheet, any trim size, paper type…"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={loading}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          {loading ? "Working…" : "Fill form from description"}
        </button>
        {localError && <p className="text-sm text-red-700">{localError}</p>}
      </div>
      {lastExplanation && (
        <p className="mt-3 text-xs leading-relaxed text-indigo-950/90">{lastExplanation}</p>
      )}
    </section>
  );
}
