/**
 * src/lib/sanitize.ts
 * ---------------------------------------------------------------------------
 * Text sanitization utility for article preview display.
 * Strips HTML tags, social syndication strings, and noise artifacts.
 * ---------------------------------------------------------------------------
 */

// ─── Social / Audio Syndication Noise Patterns ────────────────────────────────

const NOISE_PATTERNS: RegExp[] = [
  /listen\s*listen\s*\(?\d+\s*mins?\)?/gi,
  /save\s*share/gi,
  /share\s+on\s+(twitter|facebook|linkedin|reddit|whatsapp)/gi,
  /follow\s+us\s+on\s+(twitter|facebook|instagram)/gi,
  /click\s+here\s+to\s+(read\s+more|subscribe|sign\s+up)/gi,
  /\[?\s*image\s*credit[:\s][^\]]*\]?/gi,
  /\[?\s*photo\s*credit[:\s][^\]]*\]?/gi,
  /advertisement/gi,
  /skip\s+advertisement/gi,
  /related\s+articles?/gi,
  /read\s+more\s*[:–-]/gi,
  /subscribe\s+to\s+our\s+newsletter/gi,
  /sign\s+up\s+for\s+(our\s+)?(free\s+)?newsletter/gi,
  /©\s*\d{4}\s*[A-Za-z\s,.]*/g,
  /all\s+rights\s+reserved/gi,
  /continue\s+reading\s+(below\s+)?the\s+article/gi,
  /this\s+article\s+(originally|first)\s+appeared\s+in/gi,
];

// ─── HTML Tag Stripper ────────────────────────────────────────────────────────

/**
 * Remove all HTML tags from a string (both well-formed and malformed).
 */
function stripHtmlTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

// ─── Public Sanitizer ─────────────────────────────────────────────────────────

/**
 * Sanitize article preview text for safe display:
 * 1. Strip all HTML tags
 * 2. Decode common HTML entities
 * 3. Remove social syndication & audio noise strings
 * 4. Normalize whitespace
 * 5. Truncate to maxLength with clean ellipsis (not mid-word)
 */
export function sanitizePreview(raw: string | null | undefined, maxLength = 200): string {
  if (!raw) return "";

  let text = stripHtmlTags(raw);

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#\d+;/g, "");

  // Strip noise patterns
  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  // Normalize whitespace (collapse runs, trim)
  text = text.replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) return text;

  // Truncate at a word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.75 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/**
 * Extract the domain name from a URL for display.
 * Falls back to the raw author string if URL parsing fails.
 */
export function extractDomain(url: string | null | undefined, fallback = ""): string {
  if (!url) return fallback;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}
