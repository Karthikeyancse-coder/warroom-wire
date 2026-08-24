import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = [
    { id: "1", name: "GDELT", type: "gdelt", status: "ok", fetch_interval_seconds: 90 },
    { id: "2", name: "Reddit", type: "reddit", status: "ok", fetch_interval_seconds: 45 },
    { id: "3", name: "BBC World", type: "rss", status: "ok", fetch_interval_seconds: 60 },
    { id: "4", name: "Reuters", type: "rss", status: "ok", fetch_interval_seconds: 60 },
    { id: "5", name: "AP News", type: "rss", status: "ok", fetch_interval_seconds: 60 },
    { id: "6", name: "Hacker News", type: "rss", status: "ok", fetch_interval_seconds: 60 },
    { id: "7", name: "TechCrunch", type: "rss", status: "ok", fetch_interval_seconds: 60 },
    { id: "8", name: "Nostr", type: "nostr", status: "ok", fetch_interval_seconds: 0 },
    { id: "9", name: "Bluesky", type: "bluesky", status: "ok", fetch_interval_seconds: 0 },
    { id: "10", name: "Manual", type: "manual", status: "ok", fetch_interval_seconds: 0 },
  ];
  return NextResponse.json(sources);
}