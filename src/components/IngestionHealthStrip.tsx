"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Radio } from "lucide-react";
import type { IngestionStatuses } from "@/hooks/useIngestionPolling";
import type { SourceStatus } from "@/types";
import clsx from "clsx";

interface Props { statuses: IngestionStatuses; }

const SOURCE_LABELS: Record<keyof IngestionStatuses, string> = {
  gdelt:  "GDELT",
  reddit: "Reddit",
  rss:    "RSS Feeds",
};

function StatusIcon({ status }: { status: SourceStatus }) {
  if (status === "ok")          return <CheckCircle2 className="w-3.5 h-3.5 text-ok-DEFAULT" />;
  if (status === "unavailable") return <XCircle      className="w-3.5 h-3.5 text-danger-DEFAULT" />;
  if (status === "degraded")    return <AlertCircle  className="w-3.5 h-3.5 text-warn-DEFAULT" />;
  return <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />;
}

function statusColor(s: SourceStatus) {
  return clsx({
    "text-ok-DEFAULT":      s === "ok",
    "text-danger-DEFAULT":  s === "unavailable",
    "text-warn-DEFAULT":    s === "degraded",
    "text-gray-400":        s === "pending",
  });
}

export default function IngestionHealthStrip({ statuses }: Props) {
  const [workerHealth, setWorkerHealth] = useState<{ nostrActive: boolean; bskyActive: boolean }>({
    nostrActive: true,
    bskyActive: true,
  });

  useEffect(() => {
    async function checkWorkerHealth() {
      try {
        const res = await fetch("/api/articles?limit=50");
        if (res.ok) {
          const articles = await res.json();
          const cutoff = Date.now() - 5 * 60 * 1000;
          const hasNostr = articles.some(
            (a: { source_type: string; ingested_at: string }) =>
              a.source_type === "nostr" && new Date(a.ingested_at).getTime() >= cutoff
          );
          const hasBsky = articles.some(
            (a: { source_type: string; ingested_at: string }) =>
              a.source_type === "bluesky" && new Date(a.ingested_at).getTime() >= cutoff
          );
          setWorkerHealth({ nostrActive: hasNostr, bskyActive: hasBsky });
        }
      } catch {}
    }
    checkWorkerHealth();
    const interval = setInterval(checkWorkerHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-b border-surface-border bg-surface-subtle/80 px-4 py-2 transition-colors">
      <div className="w-full max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-3 text-xs">
        
        {/* Polling sources */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
            In-Browser Poller
          </span>
          {(Object.entries(statuses) as [keyof IngestionStatuses, SourceStatus][]).map(
            ([src, status]) => (
              <div key={src} className="flex items-center gap-1.5">
                <StatusIcon status={status} />
                <span className={clsx("font-semibold", statusColor(status))}>
                  {SOURCE_LABELS[src]}
                </span>
                <span className="text-gray-400 capitalize text-[11px]">
                  ({status === "ok" ? "Ok" : status === "degraded" ? "Degraded" : status === "unavailable" ? "Unavailable" : "Connecting..."})
                </span>
              </div>
            )
          )}
        </div>

        {/* Real-time firehoses */}
        <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="font-semibold text-purple-600 dark:text-purple-400">Nostr</span>
            <span>(3 Relays)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="font-semibold text-sky-600 dark:text-sky-400">Bluesky</span>
            <span>(Jetstream)</span>
          </div>
        </div>

      </div>
    </div>
  );
}