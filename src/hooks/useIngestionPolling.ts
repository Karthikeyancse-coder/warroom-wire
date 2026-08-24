"use client";

import { useEffect, useRef, useState } from "react";
import type { IngestionResult, SourceStatus } from "@/types";

// ---------------------------------------------------------------------------
// useIngestionPolling
//
// Drives GDELT / Reddit / RSS ingestion from the open browser tab.
// Only sends requests to internal relative endpoints (/api/ingest/*).
// ---------------------------------------------------------------------------

export interface IngestionStatuses {
  gdelt:  SourceStatus;
  reddit: SourceStatus;
  rss:    SourceStatus;
}

const INTERVALS = {
  reddit: 45_000,  // 45 s
  rss:    60_000,  // 60 s
  gdelt:  90_000,  // 90 s
} as const;

type Source = keyof typeof INTERVALS;

const SOURCE_COLORS: Record<Source, string> = {
  gdelt:  "color: #a855f7; font-weight: bold;",
  reddit: "color: #f97316; font-weight: bold;",
  rss:    "color: #10b981; font-weight: bold;",
};

interface DetailedIngestionResult extends IngestionResult {
  successful_feeds?: number;
  total_feeds?: number;
  warning?: string;
  count?: number;
}

async function callIngest(source: Source): Promise<{ status: SourceStatus; data?: DetailedIngestionResult }> {
  const timeStr = new Date().toLocaleTimeString();
  console.log(
    `%c[Ingestion] [${timeStr}] Triggering /api/ingest/${source} (interval: ${INTERVALS[source] / 1000}s)...`,
    SOURCE_COLORS[source]
  );

  try {
    const res = await fetch(`/api/ingest/${source}`, { method: "POST" });
    if (!res.ok) {
      console.warn(`%c[Ingestion] [${timeStr}] /api/ingest/${source} returned HTTP ${res.status}`, "color: #ef4444;");
      return { status: "degraded" };
    }

    const data = (await res.json()) as DetailedIngestionResult;
    console.log(
      `%c[Ingestion] [${timeStr}] /api/ingest/${source} -> status: ${data.status}, inserted: ${data.inserted ?? 0}`,
      SOURCE_COLORS[source]
    );

    // Specific status logic per source requirements
    if (source === "gdelt") {
      // GDELT: Mark Ok when the internal API responds with HTTP 200 (even if items = 0)
      return { status: "ok", data };
    }

    if (source === "rss") {
      // RSS Feeds: Mark Ok if at least 50% of feeds succeed; mark Degraded only if all fail
      if (typeof data.successful_feeds === "number" && typeof data.total_feeds === "number") {
        if (data.successful_feeds >= Math.ceil(data.total_feeds * 0.5)) {
          return { status: "ok", data };
        } else if (data.successful_feeds > 0) {
          return { status: "ok", data }; // Still ok if at least 1 feed succeeded
        } else {
          return { status: "degraded", data };
        }
      }
      return { status: data.status === "ok" ? "ok" : "degraded", data };
    }

    // Default for reddit / other
    return { status: data.status ?? "ok", data };
  } catch (err) {
    console.error(`%c[Ingestion] [${timeStr}] /api/ingest/${source} fetch error:`, "color: #ef4444;", err);
    return { status: "degraded" };
  }
}

export function useIngestionPolling() {
  const [statuses, setStatuses] = useState<IngestionStatuses>({
    gdelt:  "pending",
    reddit: "pending",
    rss:    "pending",
  });
  const timers = useRef<Record<Source, ReturnType<typeof setTimeout> | null>>({
    gdelt: null, reddit: null, rss: null,
  });

  useEffect(() => {
    console.log("%c[Ingestion Polling] Initialized in browser layout.", "color: #38bdf8; font-weight: bold;");

    async function poll(source: Source) {
      const { status } = await callIngest(source);
      setStatuses((prev) => ({
        ...prev,
        [source]: status,
      }));
      // Schedule next recurring poll
      timers.current[source] = setTimeout(() => poll(source), INTERVALS[source]);
    }

    // Stagger initial calls on first page load
    const offsets: Record<Source, number> = { gdelt: 500, reddit: 3_000, rss: 5_000 };
    (Object.keys(INTERVALS) as Source[]).forEach((src) => {
      timers.current[src] = setTimeout(() => poll(src), offsets[src]);
    });

    return () => {
      (Object.keys(timers.current) as Source[]).forEach((src) => {
        if (timers.current[src]) clearTimeout(timers.current[src]!);
      });
    };
  }, []);

  return { statuses };
}