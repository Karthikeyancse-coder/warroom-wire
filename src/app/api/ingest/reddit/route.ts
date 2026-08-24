import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";
import type { IngestionResult } from "@/types";

const SUBREDDITS = ["worldnews", "news"];

let lastFetchedAt = 0;
const MIN_INTERVAL_MS = 40_000;

export async function POST(): Promise<NextResponse> {
  const now = Date.now();
  if (now - lastFetchedAt < MIN_INTERVAL_MS) {
    return NextResponse.json<IngestionResult>({ source: "reddit", status: "ok", inserted: 0, skipped: 0 });
  }
  lastFetchedAt = now;
  const fetchTimeIso = new Date(now).toISOString();

  let totalInserted = 0;
  const supabase = createServiceClient();

  try {
    for (const sub of SUBREDDITS) {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=15`, {
          headers: { "User-Agent": "WarRoomWire/1.0 (crisis news monitor; hackathon demo)" },
          signal: AbortSignal.timeout(8_000),
          cache: "no-store",
        });
        if (!res.ok) continue;

        const json = await res.json();
        const posts: unknown[] = json?.data?.children ?? [];

        for (const child of posts) {
          const post = (child as { data: Record<string, unknown> }).data;
          if (!post?.url || post.is_video) continue;

          // Reddit real creation time in UTC
          const publishedAt = post.created_utc
            ? new Date(Number(post.created_utc) * 1000).toISOString()
            : fetchTimeIso;

          const record = {
            source_type:  "reddit" as const,
            external_id:  `reddit_${post.id}`,
            title:        String(post.title ?? "").slice(0, 255),
            summary:      post.selftext ? String(post.selftext).slice(0, 500) : null,
            url:          String(post.url),
            author:       post.author ? `u/${post.author}` : null,
            published_at: publishedAt,
            ingested_at:  fetchTimeIso,
            tier:         Number(post.score) > 10000 ? "major" as const : "standard" as const,
            tags:         [sub],
            is_breaking:  false,
            is_manual:    false,
            score:        Number(post.score ?? 0),
            metadata:     { subreddit: sub },
          };

          const { inserted } = upsertArticle(record);
          if (inserted) totalInserted++;

          try {
            await supabase.from("articles").upsert(record, { onConflict: "external_id", ignoreDuplicates: true });
          } catch {}
        }
      } catch { /* ignore individual subreddit errors */ }
    }
    return NextResponse.json<IngestionResult>({ source: "reddit", status: "ok", inserted: totalInserted, skipped: 0 });
  } catch (err) {
    return NextResponse.json<IngestionResult>({ source: "reddit", status: "unavailable", inserted: 0, skipped: 0, error: String(err) });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger Reddit ingestion" });
}