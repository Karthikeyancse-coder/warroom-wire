#!/usr/bin/env node
/**
 * scripts/nostr-listener.js
 * ---------------------------------------------------------------------------
 * Standalone Nostr firehose listener for War-Room Wire.
 * Connects to 4 public relays, filters by crisis keywords,
 * and forwards matched events to /api/ingest/nostr with structured logging.
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
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://nostr.mom",
];

const CRISIS_KEYWORDS = [
  "breaking", "alert", "urgent", "crisis", "emergency", "war", "attack",
  "explosion", "earthquake", "wildfire", "flood", "evacuation", "protest",
  "cyberattack", "hostage", "missile", "casualty", "outage", "disaster",
  "blackout", "lockdown", "pandemic",
];

const API_BASE_URL   = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const INGEST_SECRET  = process.env.NOSTR_INGEST_SECRET || "dev_secret_nostr";
const URL_REGEX      = /https:\/\/[^\s<>"')\]]+/;

console.log("==========================================================");
console.log("  War-Room Wire — Nostr Firehose Listener");
console.log(`  Relays:   ${RELAYS.join(", ")}`);
console.log(`  Endpoint: ${API_BASE_URL}/api/ingest/nostr`);
console.log("==========================================================\n");

// ── Helpers ────────────────────────────────────────────────────────────────
function matchesKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

const seenEvents = new Set();

async function forwardNoteToApi(event, relayUrl) {
  if (!event?.id) return;
  if (seenEvents.has(event.id)) return;
  seenEvents.add(event.id);
  if (seenEvents.size > 10000) seenEvents.delete(seenEvents.values().next().value);

  const rawContent = String(event.content || "").trim();
  if (!matchesKeywords(rawContent)) return;

  // Detect embedded URL
  const urlMatch = rawContent.match(URL_REGEX);
  const detectedUrl = urlMatch ? urlMatch[0] : null;

  if (detectedUrl) {
    console.log(`[LINK DETECTED] ${detectedUrl}`);
  }

  const firstLine   = rawContent.split("\n")[0].trim();
  const title       = firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
  const pubkeyShort = event.pubkey ? `npub...${event.pubkey.slice(-6)}` : "nostr:user";
  const noteUrl     = detectedUrl ?? `https://njump.me/${event.id}`;

  const payload = {
    external_id:  `nostr_${event.id}`,
    title:        title || "Nostr Intel Note",
    summary:      rawContent.slice(0, 500),
    url:          noteUrl,
    author:       pubkeyShort,
    published_at: new Date((event.created_at || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    metadata:     { relay: relayUrl, event_id: event.id, pubkey: event.pubkey },
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/ingest/nostr`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${INGEST_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.dropped) {
        console.log(`[DROPPED] Reason: ${data.dropped} | "${title.slice(0, 60)}"`);
      } else if (data.success) {
        const badge = data.verified ? "[VERIFIED]" : "[FORWARDED]";
        console.log(`${badge} "${title.slice(0, 60)}" — ${pubkeyShort}`);
      }
    }
  } catch {
    // API offline — silently continue
  }
}

// ── Per-relay connection ───────────────────────────────────────────────────
function connectToRelay(relayUrl) {
  let reconnectDelay = 5000;
  const subId        = `wrw_${Math.random().toString(36).slice(2, 8)}`;

  function connect() {
    try {
      const ws = new WebSocket(relayUrl, { handshakeTimeout: 8000 });

      ws.on("open", () => {
        console.log(`[Nostr Relay] ✅ Connected → ${relayUrl}`);
        reconnectDelay = 5000;
        ws.send(JSON.stringify(["REQ", subId, { kinds: [1], since: Math.floor(Date.now() / 1000) }]));
      });

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (Array.isArray(msg) && msg[0] === "EVENT" && msg[2]) {
            forwardNoteToApi(msg[2], relayUrl);
          }
        } catch {}
      });

      ws.on("error", () => {});

      ws.on("close", () => {
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, 60000);
      });
    } catch {
      setTimeout(connect, reconnectDelay);
    }
  }

  connect();
}

RELAYS.forEach((relay) => connectToRelay(relay));