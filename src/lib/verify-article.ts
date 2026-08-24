/**
 * src/lib/verify-article.ts
 * ---------------------------------------------------------------------------
 * High-speed article link validator for War-Room Wire ingestion pipeline.
 * Uses cheerio (zero-DOM) for HTML parsing — no JSDOM/Readability overhead.
 * Now extracts image_url from OG/Twitter meta tags.
 * ---------------------------------------------------------------------------
 */

import * as cheerio from "cheerio";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VerifiedArticle {
  title: string;
  cleanText: string;
  siteName: string;
  canonicalUrl: string;
  publishedAt: string | null;
  imageUrl: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VERIFY_TIMEOUT_MS = 3500;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "ref", "source", "campaign",
  "_ga", "mc_cid", "mc_eid",
]);

const PAYWALL_PATTERNS = [
  /subscribe (to|now|today)/i,
  /sign in to (read|continue|access)/i,
  /access denied/i,
  /create an? (free )?account/i,
  /this content is for (subscribers|members)/i,
  /you['']ve reached your (free )?article limit/i,
  /register (for free|to continue)/i,
  /log in to read/i,
];

const BLOCKED_DOMAINS = new Set([
  "nytimes.com", "wsj.com", "ft.com", "bloomberg.com",
  "thetimes.co.uk", "economist.com",
]);

const MIN_TEXT_LENGTH = 150;

// ─── URL Utilities ────────────────────────────────────────────────────────────

export function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https:\/\/[^\s<>"')\]]+/);
  return match ? match[0] : null;
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const cleaned = rawUrl.replace(/[.,;!?)\]>]+$/, "");
    const url = new URL(cleaned);
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

// ─── Image URL Extraction ─────────────────────────────────────────────────────

function extractImageUrl(
  $: ReturnType<typeof cheerio.load>,
  baseUrl: string
): string | null {
  const candidates = [
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
  ];

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    try {
      // Resolve relative URLs to absolute using the page's base URL
      const absolute = new URL(raw.trim(), baseUrl).toString();
      // Basic sanity: must look like an image URL
      if (/\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(absolute) ||
          absolute.includes("/image") ||
          absolute.includes("img") ||
          absolute.startsWith("https://")) {
        return absolute.slice(0, 600);
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Paywall / Soft-error Detection ──────────────────────────────────────────

function isPaywalled(title: string, bodyText: string): boolean {
  const combined = `${title} ${bodyText.slice(0, 400)}`.toLowerCase();
  return PAYWALL_PATTERNS.some((p) => p.test(combined));
}

function isDomainBlocked(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}

// ─── Main Verifier ────────────────────────────────────────────────────────────

export async function verifyArticle(rawUrl: string): Promise<VerifiedArticle | null> {
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(rawUrl);
    new URL(normalizedUrl);
  } catch {
    return null;
  }

  if (isDomainBlocked(normalizedUrl)) return null;

  try {
    const res = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    if (res.status !== 200) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // ── Title ──────────────────────────────────────────────────────────────
    const ogTitle  = $('meta[property="og:title"]').attr("content")?.trim();
    const tagTitle = $("title").first().text().trim();
    const h1Title  = $("h1").first().text().trim();
    const title    = ogTitle || h1Title || tagTitle || "";

    if (!title) return null;

    // ── Canonical URL ──────────────────────────────────────────────────────
    const canonical =
      $('link[rel="canonical"]').attr("href")?.trim() ||
      $('meta[property="og:url"]').attr("content")?.trim() ||
      normalizedUrl;

    // ── Site Name ──────────────────────────────────────────────────────────
    const siteName =
      $('meta[property="og:site_name"]').attr("content")?.trim() ||
      new URL(normalizedUrl).hostname.replace(/^www\./, "");

    // ── Published At ───────────────────────────────────────────────────────
    const publishedAt =
      $('meta[property="article:published_time"]').attr("content")?.trim() ||
      $('meta[name="pubdate"]').attr("content")?.trim() ||
      $('time[datetime]').first().attr("datetime")?.trim() ||
      null;

    // ── Image URL ──────────────────────────────────────────────────────────
    const imageUrl = extractImageUrl($, normalizedUrl);

    // ── Body Text Extraction ───────────────────────────────────────────────
    $("script, style, nav, footer, header, aside, .ad, .advertisement, .paywall, [class*='subscribe'], [id*='subscribe'], noscript").remove();

    let cleanText = "";
    const containers = ["article", "main", '[role="main"]', ".article-body", ".post-content", ".entry-content", ".story-body"];

    for (const sel of containers) {
      const text = $(sel).text().replace(/\s+/g, " ").trim();
      if (text.length >= MIN_TEXT_LENGTH) {
        cleanText = text;
        break;
      }
    }

    if (cleanText.length < MIN_TEXT_LENGTH) {
      cleanText = $("p")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 40)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (cleanText.length < MIN_TEXT_LENGTH) return null;
    if (isPaywalled(title, cleanText)) return null;

    return {
      title:        title.slice(0, 255),
      cleanText:    cleanText.slice(0, 2000),
      siteName,
      canonicalUrl: canonical.slice(0, 500),
      publishedAt:  publishedAt ? new Date(publishedAt).toISOString() : null,
      imageUrl,
    };
  } catch {
    return null;
  }
}
