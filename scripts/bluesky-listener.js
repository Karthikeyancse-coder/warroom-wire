#!/usr/bin/env node
/**
 * scripts/bluesky-listener.js
 * ---------------------------------------------------------------------------
 * Standalone Bluesky Jetstream firehose listener for War-Room Wire.
 * Filters crisis keywords, logs structured output, forwards to API.
 * ---------------------------------------------------------------------------
 */

const fs   = require("fs");
const path = require("path");
const { WebSocket } = require("ws");

// ── Built-in .env.local loader ─────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

// ── Config ─────────────────────────────────────────────────────────────────
const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

const CRISIS_KEYWORDS = [
  "breaking", "alert", "urgent", "crisis", "emergency", "war", "attack",
  "explosion", "earthquake", "wildfire", "flood", "evacuation", "protest",
  "cyberattack", "hostage", "missile", "casualty", "outage", "disaster",
  "blackout", "lockdown", "pandemic",
];

const API_BASE_URL  = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const URL_REGEX     = /https:\/\/[^\s<>"')\]]+/;

console.log("==========================================================");
console.log("  War-Room Wire — Bluesky Jetstream Listener");
console.log(`  WebSocket: ${JETSTREAM_URL.slice(0, 60)}…`);
console.log(`  Endpoint:  ${API_BASE_URL}/api/ingest/bluesky`);
console.log("==========================================================\n");

// ── Helpers ────────────────────────────────────────────────────────────────
let reconnectDelay = 2000;

function matchesKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

function connect() {
  const ws = new WebSocket(JETSTREAM_URL);

  ws.on("open", () => {
    console.log("[Bluesky Worker] ✅ Connected to Jetstream firehose");
    reconnectDelay = 2000;
  });

  ws.on("message", async (data) => {
    try {
      const event = JSON.parse(data.toString());
      if (event.kind !== "commit") return;
      if (event.commit?.collection !== "app.bsky.feed.post") return;

      const record = event.commit?.record;
      if (!record?.text) return;

      const text = String(record.text).trim();
      if (!matchesKeywords(text)) return;

      const did      = event.did ?? "unknown";
      const rkey     = event.commit?.rkey ?? Date.now();
      const uri      = `at://${did}/app.bsky.feed.post/${rkey}`;
      const postUrl  = `https://bsky.app/profile/${did}/post/${rkey}`;
      const title    = text.length > 80 ? text.slice(0, 80) + "…" : text;

      // Detect embedded URL in post body
      const urlMatch    = text.match(URL_REGEX);
      const detectedUrl = urlMatch ? urlMatch[0] : postUrl;

      if (urlMatch) {
        console.log(`[LINK DETECTED] ${detectedUrl}`);
      }

      const payload = {
        external_id:  uri,
        title,
        summary:      text.slice(0, 500),
        url:          detectedUrl,
        author:       did.length > 24 ? `did:…${did.slice(-8)}` : did,
        published_at: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
        metadata:     { did, rkey },
      };

      const res = await fetch(`${API_BASE_URL}/api/ingest/bluesky`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.dropped) {
          console.log(`[DROPPED] Reason: ${result.dropped} | "${title.slice(0, 60)}"`);
        } else if (result.success) {
          const badge = result.verified ? "[VERIFIED]" : "[FORWARDED]";
          console.log(`${badge} "${title.slice(0, 60)}"`);
        }
      }
    } catch {}
  });

  ws.on("error", (err) => {
    console.error("[Bluesky Worker] Error:", err.message);
  });

  ws.on("close", () => {
    console.log(`[Bluesky Worker] Disconnected. Reconnecting in ${reconnectDelay / 1000}s…`);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60000);
  });
}

connect();