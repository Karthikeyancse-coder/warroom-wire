import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";
import { normalizeUrl, verifyArticle } from "@/lib/verify-article";
import { generateContentHash, generateUrlHash, isKnownDuplicate, markAsSeen } from "@/lib/dedupe";

export const dynamic = "force-dynamic";

const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=crisis%20OR%20audit%20OR%20sanctions&mode=artlist&maxrecords=20&format=json";

let lastFetchedAt = 0;
const MIN_INTERVAL_MS = 30_000;
const MAX_GDELT_ARTICLES = 10; // Cap to newest 10 articles per cycle

function parseGdeltDate(seendate: unknown, fallbackIso: string): string {
  if (!seendate) return fallbackIso;
  const str = String(seendate).trim();
  const match = str.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  if (match) {
    const [, y, m, d, h, min, s] = match;
    const date = new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s));
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  const directDate = new Date(str);
  if (!isNaN(directDate.getTime())) return directDate.toISOString();
  return fallbackIso;
}

export async function POST(): Promise<NextResponse> {
  const startTime = Date.now();
  if (startTime - lastFetchedAt < MIN_INTERVAL_MS) {
    return NextResponse.json({
      source: "gdelt",
      status: "ok",
      inserted: 0,
      skipped: 0,
      articles: [],
    });
  }
  lastFetchedAt = startTime;

  const fetchTimeIso = new Date(startTime).toISOString();
  const supabase = createServiceClient();

  try {
    const res = await fetch(GDELT_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[ingest/gdelt] Upstream returned HTTP ${res.status}`);
      return NextResponse.json({
        source: "gdelt",
        status: "ok",
        articles: [],
        inserted: 0,
        skipped: 0,
        warning: `upstream_http_${res.status}`,
      });
    }

    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      console.warn("[ingest/gdelt] Upstream returned non-JSON payload");
      return NextResponse.json({
        source: "gdelt",
        status: "ok",
        articles: [],
        inserted: 0,
        skipped: 0,
        warning: "upstream_non_json",
      });
    }

    const rawArticles: unknown[] = (json?.articles as unknown[]) ?? [];
    const cappedArticles = (rawArticles as Record<string, unknown>[]).slice(0, MAX_GDELT_ARTICLES);

    // ── Parallel per-article verification & deduplication across batch ────────
    const processingPromises = cappedArticles.map(async (art) => {
      const rawUrl = art.url ? String(art.url).trim() : null;
      const rawTitle = String(art.title ?? "Untitled").trim();
      const externalId = String(rawUrl ?? rawTitle ?? "");
      if (!externalId) return { ok: false };

      const realPublishedAt = parseGdeltDate(art.seendate, fetchTimeIso);
      let finalTitle = rawTitle.slice(0, 255);
      let finalSummary = art.seendescription ? String(art.seendescription).slice(0, 600) : null;
      let finalUrl = rawUrl;
      let imageUrl = art.socialimage ? String(art.socialimage).slice(0, 600) : null;
      let isVerified = false;

      if (rawUrl) {
        const normalizedUrl = normalizeUrl(rawUrl);
        const urlHash = generateUrlHash(normalizedUrl);
        const initialContentHash = generateContentHash(finalTitle, finalSummary ?? "");

        if (isKnownDuplicate(urlHash, initialContentHash)) {
          return { ok: false, duplicate: true };
        }

        try {
          const verified = await verifyArticle(normalizedUrl);
          if (verified) {
            finalTitle = verified.title;
            finalSummary = verified.cleanText.slice(0, 600);
            finalUrl = verified.canonicalUrl;
            imageUrl = verified.imageUrl ?? imageUrl;
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
      }

      const pubTimeMs = new Date(realPublishedAt).getTime();
      const networkLatencyMs = Math.max(0, startTime - (isNaN(pubTimeMs) ? startTime : pubTimeMs));
      const processingLatencyMs = Date.now() - startTime;

      const record = {
        source_type: "gdelt" as const,
        external_id: `gdelt_${externalId}`,
        title: finalTitle,
        summary: finalSummary,
        url: finalUrl,
        image_url: imageUrl,
        author: art.domain ? String(art.domain) : null,
        published_at: realPublishedAt,
        ingested_at: fetchTimeIso,
        tier: "standard" as const,
        tags: art.themes ? String(art.themes).split(";").slice(0, 8) : [],
        is_breaking: false,
        is_manual: false,
        score: art.socialimage ? 2 : 1,
        metadata: {
          domain: art.domain,
          lang: art.language,
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

    const settled = await Promise.allSettled(processingPromises);
    let totalInserted = 0;
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.ok) {
        totalInserted++;
      }
    }

    try {
      await supabase
        .from("sources")
        .update({ status: "ok", last_fetched_at: fetchTimeIso })
        .eq("name", "gdelt");
    } catch {}

    return NextResponse.json({
      source: "gdelt",
      status: "ok",
      inserted: totalInserted,
      skipped: cappedArticles.length - totalInserted,
      articles: cappedArticles.slice(0, 10),
      batch_time_ms: Date.now() - startTime,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[ingest/gdelt] Handled upstream timeout/error:", msg);

    try {
      await supabase
        .from("sources")
        .update({ status: "ok", last_fetched_at: fetchTimeIso })
        .eq("name", "gdelt");
    } catch {}

    return NextResponse.json({
      source: "gdelt",
      status: "ok",
      articles: [],
      inserted: 0,
      skipped: 0,
      warning: "upstream_timeout",
    });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger GDELT ingestion" });
}