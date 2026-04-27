"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  jobId: string;
  canPull: boolean;
  insufficientStock: boolean;
  alreadyPulled: boolean;
  cancelled: boolean;
};

export function PullFilmButton({
  jobId,
  canPull,
  insufficientStock,
  alreadyPulled,
  cancelled,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePull() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/job-tickets/${jobId}/pull-film`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Pull failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (cancelled) {
    return (
      <p className="text-sm text-zinc-500">Film allocation was cancelled.</p>
    );
  }
  if (alreadyPulled) {
    return (
      <p className="text-sm font-medium text-emerald-800">
        Film has been pulled from inventory for this job.
      </p>
    );
  }
  if (!canPull && !insufficientStock) {
    return null;
  }

  return (
    <div className="space-y-2">
      {insufficientStock && (
        <p className="text-sm text-amber-800">
          Roll does not have enough linear feet to pull the quoted amount. Receive stock or
          adjust inventory before pulling.
        </p>
      )}
      <button
        type="button"
        onClick={() => void handlePull()}
        disabled={!canPull || loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Pulling…" : "Pull quoted amount from roll"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
