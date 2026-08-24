import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle, queryArticles, countArticles } from "@/lib/store";
import type { Article, ArticleTier, SourceType } from "@/types";

// GET /api/articles
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const breaking = searchParams.get("breaking") === "true";
  const stats    = searchParams.get("stats")    === "true";
  const search   = searchParams.get("search")   ?? undefined;
  const since    = searchParams.get("since")    ?? undefined;
  const limit    = Math.min(Number(searchParams.get("limit")  ?? 30), 200);
  const offset   = Number(searchParams.get("offset") ?? 0);
  const tiers    = searchParams.get("tiers")?.split(",").filter(Boolean) as ArticleTier[] | undefined;
  const sources  = searchParams.get("sources")?.split(",").filter(Boolean) as SourceType[] | undefined;

  try {
    const supabase = createServiceClient();

    if (stats) {
      const { data, error } = await supabase
        .from("articles")
        .select("source_type, tier, published_at")
        .order("published_at", { ascending: false })
        .limit(500);

      if (!error && data) {
        const bySource: Record<string, number> = {};
        let breakingCount = 0;
        let lastHourCount = 0;
        const cutoff = new Date(Date.now() - 3600_000).toISOString();

        for (const a of data) {
          const src = a.source_type as SourceType;
          bySource[src] = (bySource[src] ?? 0) + 1;
          if (a.tier === "breaking") breakingCount++;
          if (a.published_at >= cutoff) lastHourCount++;
        }
        return NextResponse.json({
          total: data.length,
          breaking: breakingCount,
          lastHour: lastHourCount,
          bySource,
        });
      }
      return NextResponse.json(countArticles());
    }

    let q = supabase
      .from("articles")
      .select("*")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (breaking) q = q.eq("is_breaking", true);
    if (search)   q = q.ilike("title", `%${search}%`);
    if (tiers?.length)   q = q.in("tier", tiers);
    if (sources?.length) q = q.in("source_type", sources);
    if (since)    q = q.gte("published_at", since);

    const { data, error } = await q;

    if (!error && data && data.length > 0) {
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn("[api/articles GET] Falling back to local store:", err);
  }

  // Fallback to in-memory store
  if (stats) return NextResponse.json(countArticles());
  const articles = queryArticles({ breakingOnly: breaking, search, since, tiers, sources, limit, offset });
  return NextResponse.json(articles);
}

// POST /api/articles — manually post a breaking news article
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, summary, url, tier = "breaking" } = body as Partial<Article & { tier: ArticleTier }>;

    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const externalId = `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const article = {
      source_type:  "manual" as const,
      external_id:  externalId,
      title:        title.trim().slice(0, 255),
      summary:      summary?.trim() ?? null,
      url:          url?.trim() ?? null,
      author:       "War-Room Wire (Demo)",
      published_at: nowIso,
      ingested_at:  nowIso,
      tier,
      tags:         ["breaking", "manual"],
      is_breaking:  tier === "breaking",
      is_manual:    true,
      score:        999,
      metadata:     {},
    };

    // Save to Supabase
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("articles")
        .insert(article)
        .select()
        .single();

      if (!error && data) {
        upsertArticle(article);
        return NextResponse.json(data, { status: 201 });
      }
    } catch (err) {
      console.warn("[api/articles POST] Supabase insert fallback:", err);
    }

    // In-memory fallback
    upsertArticle(article);
    return NextResponse.json({ ...article, id: externalId, created_at: nowIso }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}