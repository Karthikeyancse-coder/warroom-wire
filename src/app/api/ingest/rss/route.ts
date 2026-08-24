import { NextResponse } from "next/server";
import { parseStringPromise } from "xml2js";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";
import type { IngestionResult } from "@/types";

const RSS_FEEDS = [
  { name: "BBC World",    url: "https://feeds.bbci.co.uk/news/world/rss.xml",        tier: "major"    },
  { name: "Reuters",      url: "https://feeds.reuters.com/reuters/topNews",            tier: "major"    },
  { name: "AP News",      url: "https://feeds.apnews.com/ApNewsAlerts",               tier: "major"    },
  { name: "Hacker News",  url: "https://hnrss.org/frontpage",                         tier: "standard" },
  { name: "TechCrunch",   url: "https://techcrunch.com/feed/",                        tier: "standard" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss",               tier: "standard" },
  { name: "Al Jazeera",   url: "https://www.aljazeera.com/xml/rss/all.xml",           tier: "major"    },
] as const;

let lastFetchedAt = 0;
const MIN_INTERVAL_MS = 50_000;

function extractPubDate(it: Record<string, unknown>, feedFetchedAt: string): string {
  // Check all common RSS / Atom / DublinCore timestamp properties
  const rawCandidate =
    it.pubDate ??
    it.pubdate ??
    it["dc:date"] ??
    it["atom:published"] ??
    it["atom:updated"] ??
    it.published ??
    it.updated ??
    it.date;

  if (rawCandidate) {
    let strVal = "";
    if (typeof rawCandidate === "string") {
      strVal = rawCandidate.trim();
    } else if (typeof rawCandidate === "object" && rawCandidate !== null) {
      strVal = String((rawCandidate as { _?: string })?._ ?? "").trim();
    }

    if (strVal) {
      const parsedDate = new Date(strVal);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString(); // Real publication timestamp
      }
    }
  }

  // Fallback only if feed had no timestamp
  return feedFetchedAt;
}

export async function POST(): Promise<NextResponse> {
  const now = Date.now();
  if (now - lastFetchedAt < MIN_INTERVAL_MS) {
    return NextResponse.json<IngestionResult>({ source: "rss", status: "ok", inserted: 0, skipped: 0 });
  }
  lastFetchedAt = now;

  const fetchTimeIso = new Date(now).toISOString();
  let totalInserted = 0;
  const feedResults: { name: string; inserted: number; error?: string }[] = [];
  const supabase = createServiceClient();

  for (const feed of RSS_FEEDS) {
    let inserted = 0;
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "WarRoomWire/1.0 (crisis news monitor; hackathon demo)" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const parsed = await parseStringPromise(text, { explicitArray: false });
      const rawItems: unknown = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      for (const item of items) {
        const it = item as Record<string, unknown>;
        const title = String((it.title as { _?: string })?._ ?? it.title ?? "").trim();
        const link  = String(it.link  ?? (it.link as unknown as { href?: string })?.href ?? "").trim();
        const desc  = String(
          (it.description as { _?: string })?._ ?? it.description ??
          (it.summary    as { _?: string })?._ ?? it.summary ?? ""
        ).slice(0, 600);

        if (!title || !link) continue;

        // Accurate real publish date from the feed's <pubDate> / <dc:date> tag
        const realPublishedAt = extractPubDate(it, fetchTimeIso);

        const record = {
          source_type:  "rss" as const,
          external_id:  `rss_${link}`,
          title:        title.slice(0, 255),
          summary:      desc || null,
          url:          link,
          author:       feed.name,
          published_at: realPublishedAt,  // Real article publish time
          ingested_at:  fetchTimeIso,     // Pipeline ingestion time
          tier:         feed.tier as "major" | "standard",
          tags:         [feed.name.toLowerCase().replace(/\s+/g, "-")],
          is_breaking:  false,
          is_manual:    false,
          score:        1,
          metadata:     { feed: feed.name },
        };

        const { inserted: ok } = upsertArticle(record);
        if (ok) { inserted++; totalInserted++; }

        try {
          await supabase.from("articles").upsert(record, { onConflict: "external_id", ignoreDuplicates: true });
        } catch {}
      }
      feedResults.push({ name: feed.name, inserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      feedResults.push({ name: feed.name, inserted: 0, error: msg });
    }
  }

  const anyFailed = feedResults.some((f) => f.error);
  return NextResponse.json({
    source: "rss",
    status: anyFailed ? "degraded" : "ok",
    inserted: totalInserted,
    skipped: 0,
    feeds: feedResults,
  });
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger RSS ingestion" });
}