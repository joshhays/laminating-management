"use client";

import { getSupabaseBrowser } from "@/lib/print-scheduler/supabase-browser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

const CHANNEL = "print-schedule-board";
const EVENT_OPERATOR = "operator_job";

export type OperatorPayload = { jobId: string; active: boolean; operatorName?: string };

export function useScheduleBroadcast() {
  const [operatorActiveByJobId, setOperatorActiveByJobId] = useState<Record<string, boolean>>(
    {},
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const ch = supabase
      .channel(CHANNEL)
      .on("broadcast", { event: EVENT_OPERATOR }, ({ payload }) => {
        const p = payload as OperatorPayload | null;
        if (!p?.jobId) return;
        setOperatorActiveByJobId((prev) => ({
          ...prev,
          [p.jobId]: Boolean(p.active),
        }));
      })
      .subscribe();

    channelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, []);

  async function broadcastOperatorJob(payload: OperatorPayload) {
    const ch = channelRef.current;
    if (!ch) return false;
    try {
      await ch.send({
        type: "broadcast",
        event: EVENT_OPERATOR,
        payload,
      });
      return true;
    } catch {
      return false;
    }
  }

  return { operatorActiveByJobId, setOperatorActiveByJobId, broadcastOperatorJob };
}
