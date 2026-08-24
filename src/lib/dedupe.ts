/**
 * src/lib/dedupe.ts
 * ---------------------------------------------------------------------------
 * Fast two-phase deduplication for War-Room Wire ingestion pipeline.
 * Phase 1: O(1) in-memory rolling LRU cache with 2-hour TTL (max 5000 items).
 * Phase 2: Supabase `content_hash` unique index check for cross-process dedup.
 * ---------------------------------------------------------------------------
 */

import crypto from "crypto";

// ─── Content Hash ─────────────────────────────────────────────────────────────

/**
 * Deterministic SHA-256 content fingerprint.
 * Normalization: lowercase, trim whitespace, use only first 200 chars of text.
 */
export function generateContentHash(title: string, text: string): string {
  const normalized = (title.trim() + text.slice(0, 200).trim()).toLowerCase();
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * URL hash — normalized URL fingerprint for URL-level dedup.
 */
export function generateUrlHash(url: string): string {
  return crypto.createHash("sha256").update(url.toLowerCase().trim(), "utf8").digest("hex");
}

// ─── Rolling LRU Cache ────────────────────────────────────────────────────────

interface CacheEntry {
  expiresAt: number;
}

const TTL_MS    = 2 * 60 * 60 * 1000; // 2 hours
const MAX_ITEMS = 5000;

/**
 * Global singleton cache so it persists across Next.js hot-reloads in dev.
 * Each entry tracks its expiry so we can evict stale items during check.
 */
declare global {
  // eslint-disable-next-line no-var
  var __dedupeCache: Map<string, CacheEntry> | undefined;
}

function getCache(): Map<string, CacheEntry> {
  if (!global.__dedupeCache) {
    global.__dedupeCache = new Map();
  }
  return global.__dedupeCache;
}

function evictExpired(cache: Map<string, CacheEntry>): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(key);
  }
}

function evictOldest(cache: Map<string, CacheEntry>): void {
  // Map preserves insertion order — delete the oldest entry
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) cache.delete(firstKey);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if a URL or content hash is a known duplicate.
 * Returns true if this item should be dropped.
 */
export function isKnownDuplicate(urlHash: string, contentHash: string): boolean {
  const cache = getCache();
  const now = Date.now();

  // Check URL hash
  const urlEntry = cache.get(urlHash);
  if (urlEntry) {
    if (urlEntry.expiresAt > now) return true;
    cache.delete(urlHash); // stale, remove
  }

  // Check content hash
  const contentEntry = cache.get(contentHash);
  if (contentEntry) {
    if (contentEntry.expiresAt > now) return true;
    cache.delete(contentHash); // stale, remove
  }

  return false;
}

/**
 * Mark a URL and content hash as seen after a successful DB insert.
 * Performs TTL eviction and LRU bounding.
 */
export function markAsSeen(urlHash: string, contentHash: string): void {
  const cache = getCache();
  const expiresAt = Date.now() + TTL_MS;

  // Periodically evict expired entries (every ~100 inserts)
  if (cache.size % 100 === 0) evictExpired(cache);

  // Enforce max capacity
  while (cache.size >= MAX_ITEMS) evictOldest(cache);

  cache.set(urlHash, { expiresAt });
  cache.set(contentHash, { expiresAt });
}

/**
 * Returns cache stats for health monitoring.
 */
export function getCacheStats(): { size: number; maxItems: number; ttlHours: number } {
  return {
    size: getCache().size,
    maxItems: MAX_ITEMS,
    ttlHours: TTL_MS / 3_600_000,
  };
}
