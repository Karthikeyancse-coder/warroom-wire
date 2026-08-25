import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { queryArticles, countArticles, upsertArticle } from "@/lib/store";
import type { ArticleTier, SourceType } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const breaking  = searchParams.get("breaking") === "true";
  const search    = searchParams.get("search")   ?? undefined;
  const since     = searchParams.get("since")    ?? undefined;
  const tiers     = searchParams.get("tiers")?.split(",").filter(Boolean) as ArticleTier[] | undefined;
  const sources   = searchParams.get("sources")?.split(",").filter(Boolean) as SourceType[] | undefined;
  const limit     = Number(searchParams.get("limit")  ?? 50);
  const offset    = Number(searchParams.get("offset") ?? 0);
  const stats     = searchParams.get("stats") === "true";

  // Try Supabase first
  try {
    const supabase = createClient();

    if (stats) {
      const { count: total } = await supabase.from("articles").select("*", { count: "exact", head: true });
      const { count: breakingCount } = await supabase.from("articles").select("*", { count: "exact", head: true }).eq("is_breaking", true);
      const { count: verifiedCount } = await supabase.from("articles").select("*", { count: "exact", head: true }).eq("verified", true);

      return NextResponse.json({
        total: total ?? 0,
        breaking: breakingCount ?? 0,
        major: 0,
        standard: 0,
        minor: 0,
        verified: verifiedCount ?? 0,
        sources: {},
      });
    }

    let q = supabase
      .from("articles")
      .select("*")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (breaking) q = q.eq("is_breaking", true);
    if (tiers?.length)   q = q.in("tier", tiers);
    if (sources?.length) q = q.in("source_type", sources);
    if (search)   q = q.ilike("title", `%${search}%`);
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

// POST /api/articles — manually post a breaking news article (Requires admin authorization)
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const adminKeyHeader = req.headers.get("x-admin-key") ?? "";
    const expectedSecret = process.env.MANUAL_POST_SECRET || process.env.NEXT_PUBLIC_ADMIN_KEY || "warroom_admin_secret";

    const isAuthorized =
      authHeader === `Bearer ${expectedSecret}` ||
      adminKeyHeader === expectedSecret;

    if (expectedSecret && !isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid admin key (pass 'x-admin-key' or Authorization Bearer header)" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, summary, url, tier = "breaking" } = body as {
      title?: string;
      summary?: string;
      url?: string;
      tier?: ArticleTier;
    };

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
      image_url:    null,
      author:       "War-Room Wire (Demo)",
      published_at: nowIso,
      ingested_at:  nowIso,
      tier,
      tags:         ["breaking", "manual"],
      is_breaking:  tier === "breaking",
      is_manual:    true,
      score:        999,
      metadata:     {
        network_latency_ms: 0,
        processing_latency_ms: 12,
      },
      verified:     true,
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