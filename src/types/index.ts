// ---------------------------------------------------------------------------
// Shared TypeScript types for War-Room Wire
// ---------------------------------------------------------------------------

export type SourceType = "gdelt" | "reddit" | "rss" | "bluesky" | "nostr" | "manual";

export type SourceStatus = "ok" | "unavailable" | "degraded" | "pending";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string | null;
  status: SourceStatus;
  last_fetched_at: string | null;
  fetch_interval_seconds: number;
  config: Record<string, unknown>;
  created_at: string;
}

export type ArticleTier = "breaking" | "major" | "standard" | "minor";

export interface Article {
  id: string;
  source_id: string | null;
  source_type: SourceType;
  external_id: string | null;
  title: string;
  summary: string | null;
  url: string | null;
  author: string | null;
  published_at: string;       // Real publication timestamp from the source publisher
  ingested_at: string;        // Timestamp when our pipeline fetched/ingested the item
  tier: ArticleTier;
  tags: string[];
  is_breaking: boolean;
  is_manual: boolean;
  score: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IngestionResult {
  source: string;
  status: SourceStatus;
  inserted: number;
  skipped: number;
  error?: string;
}

export interface FeedFilters {
  search: string;
  tiers: ArticleTier[];
  sources: SourceType[];
  since: "1h" | "6h" | "24h" | "7d" | "all";
}