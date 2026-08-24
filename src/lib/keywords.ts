/**
 * src/lib/keywords.ts
 * ---------------------------------------------------------------------------
 * Shared keyword filtering dictionary for social firehose ingestion
 * (Bluesky Jetstream & Nostr relays).
 * ---------------------------------------------------------------------------
 */

export const CRISIS_KEYWORDS = [
  "breaking",
  "alert",
  "urgent",
  "crisis",
  "emergency",
  "war",
  "attack",
  "explosion",
  "earthquake",
  "wildfire",
  "flood",
  "evacuation",
  "protest",
  "cyberattack",
  "hostage",
  "missile",
  "casualty",
  "outage",
  "disaster",
  "blackout",
  "lockdown",
  "pandemic",
] as const;

export function matchesCrisisKeywords(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}