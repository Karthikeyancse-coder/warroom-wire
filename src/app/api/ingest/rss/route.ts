import { NextResponse } from "next/server";
import { parseStringPromise } from "xml2js";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";
import { extractUrlFromText, normalizeUrl, verifyArticle } from "@/lib/verify-article";
import { generateContentHash, generateUrlHash, isKnownDuplicate, markAsSeen } from "@/lib/dedupe";

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
const MAX_ARTICLES_PER_FEED = 8; // Cap to newest 8 articles per feed per cycle

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
  const startTime = Date.now();
  if (startTime - lastFetchedAt < MIN_INTERVAL_MS) {
    return NextResponse.json({
      source: "rss",
      status: "ok",
      count: 0,
      inserted: 0,
      skipped: 0,
      failed_sources: [],
    });
  }
  lastFetchedAt = startTime;

  const fetchTimeIso = new Date(startTime).toISOString();
  const supabase = createServiceClient();

  // ── 1. Parallel fetch across all RSS feeds with 5s timeout & browser UA ─────────
  const feedFetchPromises = RSS_FEEDS.map(async (feed) => {
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

  const feedSettled = await Promise.allSettled(feedFetchPromises);

  let totalInserted = 0;
  let successCount = 0;
  const failedSources: { name: string; reason: string }[] = [];
  const articlesToProcess: {
    feed: typeof RSS_FEEDS[number];
    item: Record<string, unknown>;
  }[] = [];

  for (let i = 0; i < feedSettled.length; i++) {
    const result = feedSettled[i];
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

      // Cap to newest MAX_ARTICLES_PER_FEED
      const capped = items.slice(0, MAX_ARTICLES_PER_FEED);
      for (const item of capped) {
        if (item && typeof item === "object") {
          articlesToProcess.push({ feed, item: item as Record<string, unknown> });
        }
      }
      successCount++;
    } catch (err) {
      failedSources.push({
        name: feedConfig.name,
        reason: err instanceof Error ? err.message : "XML parse error",
      });
    }
  }

  // ── 2. Parallel per-article verification & deduplication across whole batch ──
  const articleProcessingPromises = articlesToProcess.map(async ({ feed, item }) => {
    const title = String((item.title as { _?: string })?._ ?? item.title ?? "").trim();
    const rawLink = String(item.link ?? (item.link as unknown as { href?: string })?.href ?? "").trim();
    const desc = String(
      (item.description as { _?: string })?._ ??
        item.description ??
        (item.summary as { _?: string })?._ ??
        item.summary ??
        ""
    ).slice(0, 600);

    if (!title || !rawLink) return { ok: false };

    const realPublishedAt = extractPubDate(item, fetchTimeIso);
    let finalTitle = title.slice(0, 255);
    let finalSummary = desc || null;
    let finalUrl = rawLink;
    let imageUrl: string | null = null;
    let isVerified = false;

    // Fast deduplication pre-check
    const normalizedUrl = normalizeUrl(rawLink);
    const urlHash = generateUrlHash(normalizedUrl);
    const initialContentHash = generateContentHash(finalTitle, finalSummary ?? "");

    if (isKnownDuplicate(urlHash, initialContentHash)) {
      return { ok: false, duplicate: true };
    }

    // Optional rapid link verification with fallback
    try {
      const verified = await verifyArticle(normalizedUrl);
      if (verified) {
        finalTitle = verified.title;
        finalSummary = verified.cleanText.slice(0, 600);
        finalUrl = verified.canonicalUrl;
        imageUrl = verified.imageUrl;
        isVerified = true;

        const contentHash = generateContentHash(finalTitle, verified.cleanText);
        if (isKnownDuplicate(urlHash, contentHash)) {
          return { ok: false, duplicate: true };
        }
        markAsSeen(urlHash, contentHash);
      } else {
        markAsSeen(urlHash, initialContentHash);
      }
    } catch {
      markAsSeen(urlHash, initialContentHash);
    }

    const pubTimeMs = new Date(realPublishedAt).getTime();
    const networkLatencyMs = Math.max(0, startTime - (isNaN(pubTimeMs) ? startTime : pubTimeMs));
    const processingLatencyMs = Date.now() - startTime;

    const record = {
      source_type: "rss" as const,
      external_id: `rss_${rawLink}`,
      title: finalTitle,
      summary: finalSummary,
      url: finalUrl,
      image_url: imageUrl,
      author: feed.name,
      published_at: realPublishedAt,
      ingested_at: fetchTimeIso,
      tier: feed.tier as "major" | "standard",
      tags: [feed.name.toLowerCase().replace(/\s+/g, "-")],
      is_breaking: false,
      is_manual: false,
      score: 1,
      metadata: {
        feed: feed.name,
        network_latency_ms: networkLatencyMs,
        processing_latency_ms: processingLatencyMs,
      },
      verified: isVerified,
    };

    const { inserted: memOk } = upsertArticle(record);

    try {
      await supabase
        .from("articles")
        .upsert(record, { onConflict: "external_id", ignoreDuplicates: true });
    } catch {}

    return { ok: memOk };
  });

  const articleResults = await Promise.allSettled(articleProcessingPromises);
  for (const r of articleResults) {
    if (r.status === "fulfilled" && r.value.ok) {
      totalInserted++;
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

  const overallStatus = successCount > 0 ? "ok" : "degraded";

  return NextResponse.json({
    source: "rss",
    status: overallStatus,
    count: totalInserted,
    inserted: totalInserted,
    skipped: articlesToProcess.length - totalInserted,
    successful_feeds: successCount,
    total_feeds: RSS_FEEDS.length,
    failed_sources: failedSources,
    batch_time_ms: Date.now() - startTime,
  });
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger RSS ingestion" });
}