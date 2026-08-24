import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";
import { matchesCrisisKeywords } from "@/lib/keywords";
import { extractUrlFromText, normalizeUrl, verifyArticle } from "@/lib/verify-article";
import { generateContentHash, generateUrlHash, isKnownDuplicate, markAsSeen } from "@/lib/dedupe";
import type { Article } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { external_id, title, summary, url, author, published_at, metadata } = body;

    if (!external_id || (!title && !summary && !url)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const textToCheck = `${title ?? ""} ${summary ?? ""} ${url ?? ""}`;
    if (!matchesCrisisKeywords(textToCheck)) {
      return NextResponse.json({ dropped: "keyword_filter" });
    }

    const nowIso = new Date().toISOString();

    const rawUrl = url ?? extractUrlFromText(`${title ?? ""} ${summary ?? ""}`);
    let verifiedTitle   = title   ? String(title).slice(0, 255)   : "Bluesky Post";
    let verifiedSummary = summary ? String(summary).slice(0, 600) : null;
    let canonicalUrl    = rawUrl;
    let publishedAt     = published_at ? new Date(published_at).toISOString() : nowIso;
    let isVerified      = false;
    let imageUrl: string | null = null;

    if (rawUrl) {
      const normalizedUrlStr = normalizeUrl(rawUrl);
      const urlHash = generateUrlHash(normalizedUrlStr);
      const contentHashForUrl = generateContentHash(verifiedTitle, verifiedSummary ?? "");

      if (isKnownDuplicate(urlHash, contentHashForUrl)) {
        return NextResponse.json({ dropped: "duplicate" });
      }

      const verified = await verifyArticle(normalizedUrlStr);
      if (!verified) {
        return NextResponse.json({ dropped: "verification_failed" });
      }

      verifiedTitle   = verified.title;
      verifiedSummary = verified.cleanText.slice(0, 600);
      canonicalUrl    = verified.canonicalUrl;
      publishedAt     = verified.publishedAt ?? publishedAt;
      imageUrl        = verified.imageUrl;
      isVerified      = true;

      const contentHash = generateContentHash(verifiedTitle, verified.cleanText);
      if (isKnownDuplicate(urlHash, contentHash)) {
        return NextResponse.json({ dropped: "duplicate" });
      }
      markAsSeen(urlHash, contentHash);
    }

    const article: Omit<Article, "id" | "created_at" | "source_id"> & {
      content_hash?: string;
      verified?: boolean;
    } = {
      source_type:  "bluesky",
      external_id,
      title:        verifiedTitle,
      summary:      verifiedSummary,
      url:          canonicalUrl ? String(canonicalUrl).slice(0, 500) : null,
      image_url:    imageUrl,
      author:       author ? String(author).slice(0, 100) : "bsky:user",
      published_at: publishedAt,
      ingested_at:  nowIso,
      tier:         "minor",
      tags:         ["bluesky", "firehose"],
      is_breaking:  false,
      is_manual:    false,
      score:        0,
      metadata:     metadata ?? {},
      verified:     isVerified,
    };

    upsertArticle(article as Omit<Article, "id" | "created_at" | "source_id">);

    let articleId = external_id;
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("articles")
        .upsert(article, { onConflict: "external_id", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();

      if (!error && data?.id) articleId = data.id;
      await supabase.from("sources").update({ status: "ok", last_fetched_at: nowIso }).eq("name", "bluesky");
    } catch { /* supabase offline */ }

    return NextResponse.json({ success: true, article_id: articleId, verified: isVerified });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Bluesky ingest endpoint ready." });
}