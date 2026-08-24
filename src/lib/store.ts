/**
 * src/lib/store.ts
 * ---------------------------------------------------------------------------
 * Simple in-memory article store with demo seed data.
 * No database required. Persists in memory during dev server runtime.
 * ---------------------------------------------------------------------------
 */

import type { Article, ArticleTier, SourceType } from "@/types";

const MAX_ARTICLES = 500;

declare global {
  // eslint-disable-next-line no-var
  var __warRoomStore: Map<string, Article> | undefined;
}

const nowMs = Date.now();

const SEED_ARTICLES: Omit<Article, "id" | "created_at" | "source_id">[] = [
  {
    source_type: "manual",
    external_id: "seed_1",
    title: "Global Supply Chain Alert: Key Maritime Corridor Experiences Unprecedented Congestion",
    summary: "Critical shipping lanes report severe bottlenecks following emergency port maintenance and severe weather disruptions across major trade routes.",
    url: "https://news.ycombinator.com",
    image_url: null,
    author: "War-Room Desk",
    published_at: new Date(nowMs - 3 * 60 * 1000).toISOString(),
    ingested_at: new Date(nowMs - 2 * 60 * 1000).toISOString(),
    tier: "breaking",
    tags: ["breaking", "logistics", "supply-chain"],
    is_breaking: true,
    is_manual: true,
    score: 100,
    metadata: {},
  },
  {
    source_type: "rss",
    external_id: "seed_2",
    title: "International Renewable Energy Output Reaches Record High in Q3",
    summary: "Grid operators across Europe and Asia register highest sustained solar and wind generation levels to date, lowering fossil peak reliance.",
    url: "https://www.reuters.com",
    image_url: null,
    author: "Reuters",
    published_at: new Date(nowMs - 4 * 3600 * 1000).toISOString(),
    ingested_at: new Date(nowMs - 5 * 60 * 1000).toISOString(),
    tier: "major",
    tags: ["energy", "climate", "economy"],
    is_breaking: false,
    is_manual: false,
    score: 45,
    metadata: {},
  },
  {
    source_type: "gdelt",
    external_id: "seed_3",
    title: "Central Banks Signal Coordinated Liquidity Protocol Revisions",
    summary: "Financial authorities convene to review automated high-frequency liquidity backstops ahead of fiscal quarter transitions.",
    url: "https://www.bloomberg.com",
    image_url: null,
    author: "bloomberg.com",
    published_at: new Date(nowMs - 6 * 3600 * 1000).toISOString(),
    ingested_at: new Date(nowMs - 8 * 60 * 1000).toISOString(),
    tier: "major",
    tags: ["markets", "banking", "finance"],
    is_breaking: false,
    is_manual: false,
    score: 30,
    metadata: {},
  },
  {
    source_type: "reddit",
    external_id: "seed_4",
    title: "Cybersecurity Researchers Uncover Novel Zero-Day Affecting Core Infrastructure Firmwares",
    summary: "Patches deployed rapidly after proof-of-concept demonstration by security teams at international conference.",
    url: "https://reddit.com/r/worldnews",
    image_url: null,
    author: "u/NetSecWatch",
    published_at: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
    ingested_at: new Date(nowMs - 12 * 60 * 1000).toISOString(),
    tier: "standard",
    tags: ["security", "tech", "cyber"],
    is_breaking: false,
    is_manual: false,
    score: 850,
    metadata: {},
  },
  {
    source_type: "rss",
    external_id: "seed_5",
    title: "Autonomous Logistics Fleet Completes First Cross-Border Heavy Haul Test",
    summary: "Electric freight transports travel over 1,200 km without human intervention under strict regulatory monitoring.",
    url: "https://techcrunch.com",
    image_url: null,
    author: "TechCrunch",
    published_at: new Date(nowMs - 8 * 3600 * 1000).toISOString(),
    ingested_at: new Date(nowMs - 15 * 60 * 1000).toISOString(),
    tier: "standard",
    tags: ["tech", "ai", "transport"],
    is_breaking: false,
    is_manual: false,
    score: 20,
    metadata: {},
  },
];

function getStore(): Map<string, Article> {
  if (!global.__warRoomStore) {
    global.__warRoomStore = new Map();
    for (const seed of SEED_ARTICLES) {
      const id = `seed_${Math.random().toString(36).slice(2)}`;
      global.__warRoomStore.set(seed.external_id!, {
        id,
        source_id: null,
        created_at: seed.published_at,
        ...seed,
      });
    }
  }
  return global.__warRoomStore;
}

let _idCounter = 0;
function nextId() {
  return `mem_${Date.now()}_${++_idCounter}`;
}

export function upsertArticle(
  fields: Omit<Article, "id" | "created_at" | "source_id">
): { inserted: boolean } {
  const store = getStore();
  const key = fields.external_id ?? nextId();

  if (store.has(key)) return { inserted: false };

  const article: Article = {
    id: nextId(),
    source_id: null,
    created_at: new Date().toISOString(),
    ...fields,
    ingested_at: fields.ingested_at ?? new Date().toISOString(),
    external_id: key,
  };

  store.set(key, article);

  if (store.size > MAX_ARTICLES) {
    const sorted = [...store.entries()].sort(
      ([, a], [, b]) =>
        new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
    );
    const toDelete = sorted.slice(0, store.size - MAX_ARTICLES);
    for (const [k] of toDelete) store.delete(k);
  }

  return { inserted: true };
}

export interface QueryOptions {
  search?: string;
  tiers?: ArticleTier[];
  sources?: SourceType[];
  since?: string;
  limit?: number;
  offset?: number;
  breakingOnly?: boolean;
}

export function queryArticles(opts: QueryOptions = {}): Article[] {
  const store = getStore();
  let articles = [...store.values()];

  if (opts.breakingOnly) articles = articles.filter((a) => a.is_breaking);
  if (opts.search)       articles = articles.filter((a) => a.title.toLowerCase().includes(opts.search!.toLowerCase()));
  if (opts.tiers?.length)   articles = articles.filter((a) => opts.tiers!.includes(a.tier));
  if (opts.sources?.length) articles = articles.filter((a) => opts.sources!.includes(a.source_type));
  if (opts.since)        articles = articles.filter((a) => a.published_at >= opts.since!);

  articles.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  const offset = opts.offset ?? 0;
  const limit  = opts.limit  ?? 30;
  return articles.slice(offset, offset + limit);
}

export function countArticles(): { total: number; breaking: number; lastHour: number; bySource: Record<string, number> } {
  const store = getStore();
  const all = [...store.values()];
  const cutoff = new Date(Date.now() - 3_600_000).toISOString();
  const bySource: Record<string, number> = {};
  let breaking = 0;
  let lastHour = 0;
  for (const a of all) {
    bySource[a.source_type] = (bySource[a.source_type] ?? 0) + 1;
    if (a.is_breaking) breaking++;
    if (a.published_at >= cutoff) lastHour++;
  }
  return { total: all.length, breaking, lastHour, bySource };
}