"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  jobId: string;
  alreadyShipped: boolean;
  shippedAtLabel: string | null;
};

export function MarkShippedButton({
  jobId,
  alreadyShipped,
  shippedAtLabel,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markShipped() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/job-tickets/${jobId}/mark-shipped`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not update");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (alreadyShipped) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center">
        <p className="text-sm font-medium text-emerald-900">Shipped</p>
        <p className="mt-1 text-lg text-emerald-800">
          {shippedAtLabel ?? "Date recorded"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void markShipped()}
        disabled={loading}
        className="w-full rounded-2xl bg-emerald-600 px-6 py-5 text-lg font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-60"
      >
        {loading ? "Updating…" : "Mark as shipped"}
      </button>
      {error && (
        <p className="text-center text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
