"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  estimateId: string;
  /** Primary film roll present (required for shop-floor lamination job). */
  filmOk: boolean;
  /** GSM resolved for machine rules. */
  gsmOk: boolean;
  /** Positive order quantity. */
  qtyOk: boolean;
};

function flashSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-red-400", "rounded-lg", "transition-shadow");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-red-400", "rounded-lg", "transition-shadow");
  }, 4500);
}

export function ConvertToJobButton({ estimateId, filmOk, gsmOk, qtyOk }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateBeforeConvert = useCallback(() => {
    if (!filmOk) {
      flashSection("estimate-section-film");
      setError("This estimate has no primary film roll — add lamination / film on the quote before converting.");
      return false;
    }
    if (!gsmOk) {
      flashSection("estimate-section-paper");
      setError("Paper GSM is missing or invalid — fix substrate / GSM before converting.");
      return false;
    }
    if (!qtyOk) {
      flashSection("estimate-section-quantity");
      setError("Quantity must be a positive number of sheets before converting.");
      return false;
    }
    return true;
  }, [filmOk, gsmOk, qtyOk]);

  async function convert() {
    setError(null);
    if (!validateBeforeConvert()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/convert-to-job`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && typeof data.jobId === "string") {
        router.push(`/jobs/${data.jobId}`);
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create job");
        return;
      }
      if (typeof data.jobId === "string") {
        router.push(`/jobs/${data.jobId}`);
        return;
      }
      setError("Unexpected response");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void convert()}
        disabled={loading}
        className="w-full rounded-xl bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Creating job…" : "Convert to job ticket"}
      </button>
      <p className="text-xs text-zinc-500">
        Creates a queued shop-floor ticket linked to this estimate.{" "}
        <Link href="/estimates" className="font-medium text-zinc-700 underline hover:no-underline">
          All estimates
        </Link>
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
