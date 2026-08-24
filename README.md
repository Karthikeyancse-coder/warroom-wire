# War-Room Wire

> Real-time news & social firehose intelligence aggregation dashboard — built for hackathon demos.

Aggregates real-time feeds from **GDELT**, **Reddit**, **RSS feeds**, **Bluesky (Jetstream)**, and **Nostr (Decentralized Relays)** into a single unified stream powered by Supabase Realtime & in-memory caching. Allows instant crisis event injection via **"Post Breaking News"**.

---

## Architecture Overview

```
[ GDELT 90s ] ──┐
[ Reddit 45s ] ──┼──> [ Next.js Ingest Routes ] ──> [ Supabase Postgres / Realtime ] ──> [ Live UI Feed ]
[ RSS Feeds 60s ] ┘                 ▲                                                          ▲
                                    │                                                          │
[ Bluesky Jetstream WS ] ───────────┤                                                          │
  (Background Worker)               │                                                          │
                                    │                                                          │
[ Nostr 3x Relays WS ] ─────────────┘                                                          │
  (Background Worker)                                                                          │
                                                                                               │
[ "Post Breaking News" Button ] ───────────────────────────────────────────────────────────────┘
  (Sub-2s Real-Time Demo Injection)
```

---

## Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React, TypeScript |
| **Styling** | Tailwind CSS (Full Dark/Light Theme with System Toggle) |
| **Database** | Supabase (PostgreSQL + Realtime Channels) |
| **Social Firehoses** | Bluesky Jetstream WebSocket + Nostr Relays (Damus, nos.lol, nostr.band) |
| **Deployment** | Vercel (Web App) + Render/Railway (Background Workers) |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NOSTR_INGEST_SECRET=demo_nostr_secret_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Database Schema

In Supabase Dashboard → **SQL Editor → New query**, run [`supabase/schema.sql`](./supabase/schema.sql).

### 4. Start Next.js Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Social Firehoses: Bluesky & Nostr Workers

Because WebSockets to public firehoses cannot run in serverless functions (which timeout after a few seconds), both **Bluesky** and **Nostr** run as persistent Node.js background workers.

### 1. Nostr Firehose Listener (`scripts/nostr-listener.js`)
* Connects concurrently to 3 public relays: `wss://relay.damus.io`, `wss://nos.lol`, and `wss://relay.nostr.band`.
* Subscribes to real-time `Kind:1` text notes (`since: now`).
* Filters with shared crisis dictionary (`src/lib/keywords.ts`).
* Forwards matches via authenticated HTTP POST to `/api/ingest/nostr`.
* Individual exponential backoff per relay.

**To run locally for demo:**
```bash
node scripts/nostr-listener.js
```

**Hosting Options for Production:**
1. **Render**: Create **New + > Background Worker** (NOT a Web Service). Set Build Command `npm install` and Start Command `node scripts/nostr-listener.js`.
2. **Railway**: Deploy repo as a Background Service with start command `node scripts/nostr-listener.js`.
3. **Local Terminal**: Run in a separate terminal during hackathon presentations.

---

### 2. Bluesky Jetstream Listener (`scripts/bluesky-listener.js`)
* Connects to `wss://jetstream2.us-east.bsky.network/subscribe`.
* Filters crisis keywords and upserts directly to Supabase / live feed.

**To run locally for demo:**
```bash
node scripts/bluesky-listener.js
```

---

## WebSub (PubSubHubbub) Hub Audit for RSS Feeds

We audited the currently configured RSS feeds for declared `<link rel="hub" ...>` endpoints:

| RSS Feed | WebSub `<link rel="hub">` Declared? | Recommendation |
|---|---|---|
| **BBC World** | ❌ None | Continue 60s polling |
| **Reuters Top** | ❌ None | Continue 60s polling |
| **AP News** | ❌ None | Continue 60s polling |
| **Hacker News (hnrss)** | ❌ None | Continue 60s polling |
| **TechCrunch** | ❌ None | Continue 60s polling |
| **The Guardian** | ❌ None | Continue 60s polling |
| **Al Jazeera** | ❌ None | Continue 60s polling |

*Note: Major mainstream news syndications have largely migrated away from public Superfeedr hubs. 60-second in-browser staggered polling remains the most resilient mechanism for general news syndication.*