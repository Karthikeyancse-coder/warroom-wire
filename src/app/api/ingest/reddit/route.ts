import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";
import type { IngestionResult } from "@/types";

export const dynamic = "force-dynamic";

const SUBREDDITS = ["worldnews", "news"];

let lastFetchedAt = 0;
const MIN_INTERVAL_MS = 30_000;

export async function POST(): Promise<NextResponse> {
  const now = Date.now();
  if (now - lastFetchedAt < MIN_INTERVAL_MS) {
    return NextResponse.json<IngestionResult>({ source: "reddit", status: "ok", inserted: 0, skipped: 0 });
  }
  lastFetchedAt = now;
  const fetchTimeIso = new Date(now).toISOString();

  let totalInserted = 0;
  const supabase = createServiceClient();
  let rateLimitedOrBlocked = false;

  try {
    for (const sub of SUBREDDITS) {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=15`, {
          headers: {
            "User-Agent":
              "WarRoomWire/1.0 (crisis news monitor; https://warroom-wire.vercel.app; contact@warroomwire.org)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });

        if (res.status === 403 || res.status === 429) {
          console.warn(`[ingest/reddit] Reddit returned HTTP ${res.status} for r/${sub}`);
          rateLimitedOrBlocked = true;
          continue;
        }

        if (!res.ok) {
          console.warn(`[ingest/reddit] HTTP ${res.status} for r/${sub}`);
          continue;
        }

        const json = await res.json();
        const posts: unknown[] = json?.data?.children ?? [];

        for (const child of posts) {
          const post = (child as { data: Record<string, unknown> }).data;
          if (!post?.url || post.is_video) continue;

          const publishedAt = post.created_utc
            ? new Date(Number(post.created_utc) * 1000).toISOString()
            : fetchTimeIso;

          const record = {
            source_type:  "reddit" as const,
            external_id:  `reddit_${post.id}`,
            title:        String(post.title ?? "").slice(0, 255),
            summary:      post.selftext ? String(post.selftext).slice(0, 500) : null,
            url:          String(post.url),
            image_url:    null,
            author:       post.author ? `u/${post.author}` : null,
            published_at: publishedAt,
            ingested_at:  fetchTimeIso,
            tier:         Number(post.score) > 10000 ? ("major" as const) : ("standard" as const),
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
      } catch (subErr) {
        console.warn(`[ingest/reddit] Error fetching r/${sub}:`, subErr instanceof Error ? subErr.message : subErr);
      }
    }

    if (rateLimitedOrBlocked && totalInserted === 0) {
      try {
        await supabase
          .from("sources")
          .update({ status: "unavailable", last_fetched_at: fetchTimeIso })
          .eq("name", "reddit");
      } catch {}

      return NextResponse.json<IngestionResult>({
        source: "reddit",
        status: "unavailable",
        inserted: 0,
        skipped: 0,
        error: "reddit_rate_limited_or_blocked",
      });
    }

    try {
      await supabase
        .from("sources")
        .update({ status: "ok", last_fetched_at: fetchTimeIso })
        .eq("name", "reddit");
    } catch {}

    return NextResponse.json<IngestionResult>({
      source: "reddit",
      status: "ok",
      inserted: totalInserted,
      skipped: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[ingest/reddit] Caught top-level error:", msg);
    return NextResponse.json<IngestionResult>({
      source: "reddit",
      status: "unavailable",
      inserted: 0,
      skipped: 0,
      error: msg,
    });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger Reddit ingestion" });
}