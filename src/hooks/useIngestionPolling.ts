"use client";

import { useEffect, useRef, useState } from "react";
import type { IngestionResult, SourceStatus } from "@/types";

// ---------------------------------------------------------------------------
// useIngestionPolling
//
// Drives GDELT / Reddit / RSS ingestion from the open browser tab.
// Concurrency safe: atomic Postgres lock prevents duplicate work.
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

async function callIngest(source: Source): Promise<IngestionResult | null> {
  const timeStr = new Date().toLocaleTimeString();
  console.log(
    `%c[Ingestion] [${timeStr}] Triggering /api/ingest/${source} (interval: ${INTERVALS[source] / 1000}s)...`,
    SOURCE_COLORS[source]
  );

  try {
    const res = await fetch(`/api/ingest/${source}`, { method: "POST" });
    if (!res.ok) {
      console.warn(`%c[Ingestion] [${timeStr}] /api/ingest/${source} returned HTTP ${res.status}`, "color: #ef4444;");
      return null;
    }
    const data = (await res.json()) as IngestionResult;
    console.log(
      `%c[Ingestion] [${timeStr}] /api/ingest/${source} -> status: ${data.status}, inserted: ${data.inserted}, skipped: ${data.skipped}`,
      SOURCE_COLORS[source]
    );
    return data;
  } catch (err) {
    console.error(`%c[Ingestion] [${timeStr}] /api/ingest/${source} failed:`, "color: #ef4444;", err);
    return null;
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
      const result = await callIngest(source);
      setStatuses((prev) => ({
        ...prev,
        [source]: result?.status ?? "unavailable",
      }));
      // Schedule next recurring poll
      timers.current[source] = setTimeout(() => poll(source), INTERVALS[source]);
    }

    // Stagger initial calls on first page load
    const offsets: Record<Source, number> = { gdelt: 1_000, reddit: 6_000, rss: 12_000 };
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