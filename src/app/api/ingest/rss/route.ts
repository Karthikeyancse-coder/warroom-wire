import { NextResponse } from "next/server";
import { parseStringPromise } from "xml2js";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

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
const MIN_INTERVAL_MS = 30_000;

function extractPubDate(it: Record<string, unknown>, feedFetchedAt: string): string {
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
        return parsedDate.toISOString();
      }
    }
  }

  return feedFetchedAt;
}

export async function POST(): Promise<NextResponse> {
  const now = Date.now();
  if (now - lastFetchedAt < MIN_INTERVAL_MS) {
    return NextResponse.json({
      source: "rss",
      status: "ok",
      count: 0,
      inserted: 0,
      skipped: 0,
      failed_sources: [],
    });
  }
  lastFetchedAt = now;

  const fetchTimeIso = new Date(now).toISOString();
  const supabase = createServiceClient();

  // ── Parallel fetch across all RSS feeds with 5s timeout & browser UA ─────────
  const fetchPromises = RSS_FEEDS.map(async (feed) => {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "application/rss+xml, application/xml, text/xml;q=0.9, application/atom+xml, */*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return { feed, text };
  });

  const settled = await Promise.allSettled(fetchPromises);

  let totalInserted = 0;
  let successCount = 0;
  const failedSources: { name: string; reason: string }[] = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const feedConfig = RSS_FEEDS[i];

    if (result.status === "rejected") {
      failedSources.push({
        name: feedConfig.name,
        reason: result.reason?.message ?? "Fetch error",
      });
      continue;
    }

    try {
      const { feed, text } = result.value;
      const parsed = await parseStringPromise(text, { explicitArray: false });
      const rawItems: unknown = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      let feedInserted = 0;
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const it = item as Record<string, unknown>;
        const title = String((it.title as { _?: string })?._ ?? it.title ?? "").trim();
        const link = String(it.link ?? (it.link as unknown as { href?: string })?.href ?? "").trim();
        const desc = String(
          (it.description as { _?: string })?._ ??
            it.description ??
            (it.summary as { _?: string })?._ ??
            it.summary ??
            ""
        ).slice(0, 600);

        if (!title || !link) continue;

        const realPublishedAt = extractPubDate(it, fetchTimeIso);

        const record = {
          source_type: "rss" as const,
          external_id: `rss_${link}`,
          title: title.slice(0, 255),
          summary: desc || null,
          url: link,
          image_url: null as string | null,
          author: feed.name,
          published_at: realPublishedAt,
          ingested_at: fetchTimeIso,
          tier: feed.tier as "major" | "standard",
          tags: [feed.name.toLowerCase().replace(/\s+/g, "-")],
          is_breaking: false,
          is_manual: false,
          score: 1,
          metadata: { feed: feed.name },
        };

        const { inserted: ok } = upsertArticle(record);
        if (ok) {
          feedInserted++;
          totalInserted++;
        }

        try {
          await supabase
            .from("articles")
            .upsert(record, { onConflict: "external_id", ignoreDuplicates: true });
        } catch {}
      }

      successCount++;
    } catch (err) {
      failedSources.push({
        name: feedConfig.name,
        reason: err instanceof Error ? err.message : "XML parse error",
      });
    }
  }

  // Update Supabase source status
  try {
    const finalStatus = successCount > 0 ? "ok" : "degraded";
    await supabase
      .from("sources")
      .update({ status: finalStatus, last_fetched_at: fetchTimeIso })
      .eq("name", "rss");
  } catch {}

  // Ok as long as at least one feed succeeds
  const overallStatus = successCount > 0 ? "ok" : "degraded";

  return NextResponse.json({
    source: "rss",
    status: overallStatus,
    count: totalInserted,
    inserted: totalInserted,
    skipped: 0,
    successful_feeds: successCount,
    total_feeds: RSS_FEEDS.length,
    failed_sources: failedSources,
  });
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger RSS ingestion" });
}