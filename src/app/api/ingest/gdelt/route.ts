import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertArticle } from "@/lib/store";
import type { IngestionResult } from "@/types";

const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=news&mode=artlist&maxrecords=25&format=json&timespan=15min&sort=DateDesc";

let lastFetchedAt = 0;
const MIN_INTERVAL_MS = 60_000;

function parseGdeltDate(seendate: unknown, fallbackIso: string): string {
  if (!seendate) return fallbackIso;
  const str = String(seendate).trim();
  // Parse GDELT standard format: YYYYMMDDTHHMMSSZ or YYYYMMDDHHMMSS
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
  const now = Date.now();
  if (now - lastFetchedAt < MIN_INTERVAL_MS) {
    return NextResponse.json<IngestionResult>({ source: "gdelt", status: "ok", inserted: 0, skipped: 0 });
  }
  lastFetchedAt = now;

  const fetchTimeIso = new Date(now).toISOString();

  try {
    const res = await fetch(GDELT_URL, {
      headers: { "User-Agent": "WarRoomWire/1.0 (crisis news monitor; hackathon demo)" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`GDELT HTTP ${res.status}`);

    const json = await res.json();
    const articles: unknown[] = json?.articles ?? [];

    let inserted = 0, skipped = 0;
    const supabase = createServiceClient();

    for (const art of articles as Record<string, unknown>[]) {
      const externalId = String(art.url ?? art.title ?? "");
      if (!externalId) { skipped++; continue; }

      // Extract true article seen/publish date
      const realPublishedAt = parseGdeltDate(art.seendate, fetchTimeIso);

      const record = {
        source_type:  "gdelt" as const,
        external_id:  `gdelt_${externalId}`,
        title:        String(art.title ?? "Untitled").slice(0, 255),
        summary:      art.seendescription ? String(art.seendescription) : null,
        url:          art.url ? String(art.url) : null,
        image_url:    art.socialimage ? String(art.socialimage).slice(0, 600) : null,
        author:       art.domain ? String(art.domain) : null,
        published_at: realPublishedAt,  // Real publish date from GDELT
        ingested_at:  fetchTimeIso,     // Pipeline ingestion time
        tier:         "standard" as const,
        tags:         art.themes ? String(art.themes).split(";").slice(0, 8) : [],
        is_breaking:  false,
        is_manual:    false,
        score:        art.socialimage ? 2 : 1,
        metadata:     { domain: art.domain, lang: art.language },
      };

      // In-memory store
      const { inserted: memOk } = upsertArticle(record);
      if (memOk) inserted++;

      // Supabase upsert
      try {
        await supabase
          .from("articles")
          .upsert(record, { onConflict: "external_id", ignoreDuplicates: true });
      } catch {}
    }

    try {
      await supabase.from("sources").update({ status: "ok", last_fetched_at: fetchTimeIso }).eq("name", "gdelt");
    } catch {}

    return NextResponse.json<IngestionResult>({ source: "gdelt", status: "ok", inserted, skipped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ingest/gdelt]", msg);
    return NextResponse.json<IngestionResult>({ source: "gdelt", status: "unavailable", inserted: 0, skipped: 0, error: msg });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger GDELT ingestion" });
}