# 🛰️ War-Room Wire

> **High-Accuracy, Low-Latency Real-Time Intelligence & Crisis News Aggregation Engine**  
> *Built for high-stakes situational awareness, crisis monitoring, and live intelligence command desks.*

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%26%20Realtime-3ecf8e?style=flat-square&logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 📑 Table of Contents

1. [Project Overview & Purpose](#-project-overview--purpose)
2. [Complete Technology Stack & Rationale](#-complete-technology-stack--rationale)
3. [All External APIs & Firehoses Used](#-all-external-apis--firehoses-used)
4. [Core Architectural Pipeline](#-core-architectural-pipeline)
5. [In-Depth Feature Implementations](#-in-depth-feature-implementations)
   - [1. Link Verification & Thumbnail Extraction Engine](#1-link-verification--thumbnail-extraction-engine)
   - [2. Dual-Phase Deterministic Deduplication](#2-dual-phase-deterministic-deduplication)
   - [3. Live Telemetry & Ingest Latency Instrumentation](#3-live-telemetry--ingest-latency-instrumentation)
   - [4. High-Density 3-Column Crisis Grid UI](#4-high-density-3-column-crisis-grid-ui)
   - [5. Text Sanitization & Noise Stripper](#5-text-sanitization--noise-stripper)
   - [6. Atomic Concurrency Lock for Feed Polling](#6-atomic-concurrency-lock-for-feed-polling)
6. [Database Schema & PostgreSQL Setup](#-database-schema--postgresql-setup)
7. [Repository Structure](#-repository-structure)
8. [API Endpoints Reference](#-api-endpoints-reference)
9. [Step-by-Step Local Setup & Execution Guide](#-step-by-step-local-setup--execution-guide)
10. [Production Deployment Architecture](#-production-deployment-architecture)

---

## 🎯 Project Overview & Purpose

In emergency situations, geopolitical crises, cyber incidents, and disaster events, information travels across different mediums at vastly different speeds:
- **Decentralized social networks** (Nostr relays, Bluesky Jetstream) report events within **seconds**.
- **Mainstream news syndication** (Reuters, BBC, AP) provides high-accuracy verified articles within **minutes to hours**.
- **Global event databases** (GDELT 2.0) categorize geopolitical conflicts across hundreds of countries.

**War-Room Wire** bridges these disparate channels into a single unified dashboard. It provides:
1. **Sub-second firehose streaming** without overwhelming users with spam or dead links.
2. **Automated headless verification** using `cheerio` to validate page existence, extract thumbnails, and discard paywalls in under 3.5 seconds.
3. **Cross-feed deduplication** so the same breaking story published across multiple wires is not repeated.
4. **Transparent latency metrics** differentiating between original publisher publication times (`published_at`) and pipeline detection times (`ingested_at`).

---

## 🛠️ Complete Technology Stack & Rationale

| Category | Technology | Version | Why We Chose It |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `14.2.5` | Hybrid Server Components, zero-bundle API routes, and optimized server-side rendering. |
| **Language** | TypeScript | `^5.0` | Strict type safety across ingestion schemas, article structures, and Supabase database definitions. |
| **Styling** | Tailwind CSS | `^3.4.1` | Ultra-fast utility styling with custom glassmorphism design tokens (`backdrop-blur-md`, custom HSL colors). |
| **Icons** | Lucide React | `^0.428.0` | Lightweight, scalable vector icons (`ShieldCheck`, `Activity`, `Wifi`, `Zap`, `ExternalLink`). |
| **Database** | Supabase PostgreSQL | `pg15+` | Relational storage with JSONB metadata support, generated UUIDs, and full-text Trigram search (`pg_trgm`). |
| **Realtime Sync** | `@supabase/supabase-js` | `^2.45.0` | Native WebSocket replication publication (`supabase_realtime`) for sub-second UI updates on `INSERT`. |
| **HTML Parser** | `cheerio` | `^1.0.0` | Ultra-lightweight HTML parser (10x faster and 80% less memory than JSDOM/Readability) for sub-second link verification. |
| **XML Parser** | `xml2js` | `^0.6.2` | Fast, resilient RSS and Atom feed parser with support for Dublin Core (`dc:date`) and multiple enclosure formats. |
| **WebSocket Client** | `ws` | `^8.18.0` | High-throughput, zero-dependency Node.js WebSocket engine for continuous Nostr and Bluesky firehoses. |
| **Cryptography** | Node.js `crypto` | Built-in | Deterministic SHA-256 hash generation for duplicate fingerprinting. |

---

## 🌐 All External APIs & Firehoses Used

### 1. Nostr Decentralized Relays (WebSocket)
- **Protocols**: WebSocket (`wss://`) — NIP-01 Protocol
- **Endpoints Connected**:
  - `wss://relay.damus.io`
  - `wss://nos.lol`
  - `wss://relay.snort.social`
  - `wss://nostr.mom`
- **Subscription Filter**: `["REQ", "sub_id", { "kinds": [1], "since": <now_timestamp> }]`
- **Purpose**: Captures raw, uncensored decentralized text notes in real-time as breaking events unfold globally.

### 2. Bluesky Jetstream Firehose (WebSocket)
- **Protocol**: WebSocket (`wss://`)
- **Endpoint**: `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post`
- **Purpose**: Consumes the AT Protocol commit stream for newly published public posts matching critical crisis terms.

### 3. GDELT 2.0 Doc API (REST)
- **Protocol**: HTTP/HTTPS GET
- **Endpoint**: `https://api.gdeltproject.org/api/v2/doc/doc?query=crisis%20OR%20audit%20OR%20sanctions&mode=artlist&maxrecords=20&format=json`
- **Purpose**: Aggregates global news across hundreds of languages and countries with automated theme classification.
- **Resilience**: Server-side 6-second timeout with graceful fallback to prevent upstream GDELT rate-limits from breaking the dashboard.

### 4. Global RSS & Atom News Feeds (XML)
- **Protocol**: HTTP/HTTPS GET with `Promise.allSettled`
- **Feeds Integrated**:
  1. **BBC World News**: `https://feeds.bbci.co.uk/news/world/rss.xml`
  2. **Reuters Top News**: `https://feeds.reuters.com/reuters/topNews`
  3. **Associated Press (AP Top News)**: `https://feeds.apnews.com/ApNewsAlerts`
  4. **Hacker News (Frontpage)**: `https://hnrss.org/frontpage`
  5. **TechCrunch**: `https://techcrunch.com/feed/`
  6. **The Guardian World News**: `https://www.theguardian.com/world/rss`
  7. **Al Jazeera English**: `https://www.aljazeera.com/xml/rss/all.xml`
- **Purpose**: High-reputation journalism for verified confirmation of developing events.

### 5. Reddit WorldNews API (JSON)
- **Protocol**: HTTP/HTTPS GET
- **Endpoint**: `https://www.reddit.com/r/worldnews/hot.json?limit=25`
- **Purpose**: Community-curated breaking global events with upvote score thresholds.

---

## 📐 Core Architectural Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. PRODUCERS & FIREHOSES                          │
│                                                                             │
│  [ Nostr 4x Relays ]    [ Bluesky Jetstream ]    [ In-Browser Poller ]      │
│   (damus, nos.lol)      (jetstream2.us-east)     (GDELT, Reddit, 7x RSS)    │
└──────────┬────────────────────────┬─────────────────────────┬───────────────┘
           │                        │                         │
           └────────────────────────┼─────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       2. INGESTION & TRIAGE CONTROLLER                      │
│                                                                             │
│  [ Pre-Filter ] ──────────> Crisis Dictionary Check (<5ms)                  │
│                                   │                                         │
│  [ Link Verifier ] ───────> Fetch Target URL (3.5s Timeout, Browser UA)     │
│                             Cheerio HTML Extraction:                        │
│                             • Title & Canonical URL                         │
│                             • Article Thumbnail (OG / Twitter Image)        │
│                             • Main Body Text (>150 chars, no paywall)       │
│                                   │                                         │
│  [ Deduplicator ] ────────> SHA-256 Fingerprint Hash                        │
│                             • Phase 1: 2h Rolling In-Memory LRU Cache       │
│                             • Phase 2: DB ON CONFLICT (content_hash)        │
│                                   │                                         │
│  [ Telemetry Tracker ] ───> Compute network_latency_ms & processing_latency │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      3. STORAGE & REALTIME REPLICATION                      │
│                                                                             │
│                     [ Supabase PostgreSQL Database ]                        │
│                                   │                                         │
│                     [ supabase_realtime Publication ]                       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           4. PRESENTATION LAYER                             │
│                                                                             │
│  • <LiveFeed /> ──────────> WebSocket Subscription (Instant Prepend)        │
│  • <ArticleCardGrid /> ───> 3-Column Crisis Grid with 180px Media Header    │
│  • <BreakingNewsBanner /> > Critical Event Ticker                           │
│  • <IngestionHealthStrip >> Real-Time Ingestion Route Status & Telemetry    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💡 In-Depth Feature Implementations

### 1. Link Verification & Thumbnail Extraction Engine
*Located in [`src/lib/verify-article.ts`](./src/lib/verify-article.ts)*
- **Timeout Bound**: Uses `AbortSignal.timeout(3500)` to ensure no external link slows down the ingestion batch.
- **Metadata Extraction**: Scrapes `meta[property="og:image"]`, `meta[name="twitter:image"]`, and `link[rel="image_src"]`, resolving relative paths into absolute URLs.
- **Paywall & Spam Filter**: Evaluates content against soft-error patterns ("subscribe to read", "access denied", "sign in to continue") and drops articles with body text under 150 characters.

### 2. Dual-Phase Deterministic Deduplication
*Located in [`src/lib/dedupe.ts`](./src/lib/dedupe.ts)*
- **Hash Computation**: `SHA-256( (title.trim() + cleanText.slice(0, 200).trim()).toLowerCase() )`.
- **Phase 1 (In-Memory LRU)**: Sub-millisecond $O(1)$ memory check against a 5,000-item cache with a 2-hour TTL.
- **Phase 2 (Database Level)**: Executes PostgreSQL upserts with `ON CONFLICT (content_hash) DO NOTHING` to guarantee deduplication across multiple serverless instances or background workers.

### 3. Live Telemetry & Ingest Latency Instrumentation
*Implemented in API routes and [`src/components/ArticleCardGrid.tsx`](./src/components/ArticleCardGrid.tsx)*
- **`network_latency_ms`**: Time elapsed between publisher release (`published_at`) and our server intake.
- **`processing_latency_ms`**: Time taken to fetch the link, parse HTML with Cheerio, evaluate duplicates, and commit to PostgreSQL.
- **UI Indicator**: Displayed directly on article cards (`Ingested in 1.4s • Verified ✓`).

### 4. High-Density 3-Column Crisis Grid UI
*Located in [`src/components/ArticleCardGrid.tsx`](./src/components/ArticleCardGrid.tsx)*
- **Media Header (~180px)**: Renders the scraped article image with hover zoom (`group-hover:scale-105`) or an abstract gradient fallback (`from-slate-900 via-slate-950 to-indigo-950/40`).
- **Color-Coded Risk Badges**:
  - `CRITICAL` (Red with pulsing indicator)
  - `HIGH` (Amber)
  - `MEDIUM` (Yellow)
  - `MINOR` (Sky Blue)
- **Verified Shield**: Prominent `ShieldCheck` green badge for articles validated by the verification engine.

### 5. Text Sanitization & Noise Stripper
*Located in [`src/lib/sanitize.ts`](./src/lib/sanitize.ts)*
- Strips raw HTML and script tags.
- Removes social syndication boilerplate ("Share on Twitter", "Listen to audio 3 mins", "Photo credit: AP").
- Executes clean word-boundary truncation with ellipsis (`…`).

### 6. Atomic Concurrency Lock for Feed Polling
*Defined in [`supabase/schema.sql`](./supabase/schema.sql)*
- PostgreSQL function `claim_source_lock(p_name, p_min_interval_seconds)` uses atomic `UPDATE ... WHERE ... RETURNING` to ensure multiple open browser tabs never duplicate ingest requests.

---

## 🗄️ Database Schema & PostgreSQL Setup

The complete schema is located in [`supabase/schema.sql`](./supabase/schema.sql).

### Key Columns on `articles` Table:
* `id` (`UUID`): Primary key.
* `source_type` (`TEXT`): `nostr` | `bluesky` | `gdelt` | `reddit` | `rss` | `manual`.
* `external_id` (`TEXT UNIQUE`): Unique source identifier.
* `content_hash` (`TEXT UNIQUE`): Deterministic SHA-256 hash for deduplication.
* `verified` (`BOOLEAN DEFAULT FALSE`): Result of link verification.
* `image_url` (`TEXT`): Primary thumbnail image URL.
* `published_at` (`TIMESTAMPTZ`): Real article publication time from source.
* `ingested_at` (`TIMESTAMPTZ`): Time when War-Room Wire ingested the item.
* `tier` (`TEXT`): `breaking` | `major` | `standard` | `minor`.
* `metadata` (`JSONB`): Stores telemetry metrics (`processing_latency_ms`, `network_latency_ms`, relay info).

---

## 📂 Repository Structure

```
warroom-wire/
├── scripts/
│   ├── nostr-listener.js       # Nostr firehose worker (4 relays, 5s auto-reconnect)
│   └── bluesky-listener.js     # Bluesky Jetstream firehose worker (5s auto-reconnect)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── articles/route.ts      # Feed fetch & manual breaking news injection
│   │   │   ├── ingest/
│   │   │   │   ├── bluesky/route.ts   # Bluesky ingest & verification pipeline
│   │   │   │   ├── nostr/route.ts     # Nostr ingest & verification pipeline
│   │   │   │   ├── gdelt/route.ts     # GDELT 2.0 ingest with 6s timeout & fallback
│   │   │   │   ├── rss/route.ts       # 7-Feed Promise.allSettled RSS ingest
│   │   │   │   └── reddit/route.ts    # Reddit r/worldnews ingest
│   │   │   └── sources/route.ts       # Source registry & health telemetry
│   │   ├── globals.css                # Glassmorphism tokens, ticker animations, themes
│   │   ├── layout.tsx                 # Root layout
│   │   └── page.tsx                   # Main 3-column crisis dashboard
│   ├── components/
│   │   ├── ArticleCardGrid.tsx        # Responsive 3-column crisis card grid
│   │   ├── LiveFeed.tsx               # Supabase Realtime live feed subscriber
│   │   ├── BreakingNewsBanner.tsx     # High-priority breaking news ticker
│   │   ├── FeedColumn.tsx             # Paginated feed wrapper
│   │   ├── FilterBar.tsx              # Tier, source, and timespan filtering
│   │   ├── IngestionHealthStrip.tsx   # Ingestion status bar
│   │   ├── PostArticleModal.tsx       # "Post Breaking Intel" modal
│   │   ├── StatsPanel.tsx             # Real-time analytics breakdown
│   │   └── TopNav.tsx                 # Glassmorphism header with theme toggle & UTC clock
│   ├── hooks/
│   │   ├── useIngestionPolling.ts     # Client-side staggered poller
│   │   ├── useRealtimeFeed.ts         # Feed query & state management
│   │   └── useRelativeTime.ts         # Dynamic relative timestamp updater
│   ├── lib/
│   │   ├── verify-article.ts          # Cheerio link validator & thumbnail scraper
│   │   ├── dedupe.ts                  # SHA-256 hasher & 2-hour rolling LRU cache
│   │   ├── sanitize.ts                # HTML tag & noise stripper
│   │   ├── keywords.ts                # Crisis & emergency keyword dictionary
│   │   ├── store.ts                   # In-memory store & seed data
│   │   └── supabase/                  # Browser, server, and service-role clients
│   └── types/
│       └── index.ts                   # Type definitions (Article, Source, Filters)
└── supabase/
    └── schema.sql                     # Idempotent database schema & functions
```

---

## 📡 API Endpoints Reference

### Ingestion Endpoints (Server-Side)
* **`POST /api/ingest/nostr`**: Authenticated with `Bearer <NOSTR_INGEST_SECRET>`. Verifies link, hashes content, and upserts.
* **`POST /api/ingest/bluesky`**: Ingests AT Protocol posts, extracts URLs, verifies content, and stores.
* **`POST /api/ingest/rss`**: Concurrently fetches all 7 global RSS feeds with `Promise.allSettled` and 5s timeout.
* **`POST /api/ingest/gdelt`**: Fetches GDELT 2.0 Doc API with 6s timeout and graceful fallback.
* **`POST /api/ingest/reddit`**: Ingests top posts from r/worldnews.

### Feed Endpoints
* **`GET /api/articles`**: Retrieves paginated articles with query parameters: `?search=`, `?tiers=`, `?sources=`, `?since=`.
* **`POST /api/articles`**: Injects a manual breaking news item (sub-2-second demonstration).

---

## 🚀 Step-by-Step Local Setup & Execution Guide

### 1. Clone & Install
```bash
git clone https://github.com/Karthikeyancse-coder/warroom-wire.git
cd warroom-wire
npm install
```

### 2. Configure Environment (`.env.local`)
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NOSTR_INGEST_SECRET=demo_nostr_secret_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Initialize Database
In your Supabase project dashboard → **SQL Editor** → **New Query**, paste and run [`supabase/schema.sql`](./supabase/schema.sql).

### 4. Start the Application

Open **three terminal windows** for the full real-time experience:

```bash
# Terminal 1: Next.js Web App
npm run dev

# Terminal 2: Nostr Firehose Worker
node scripts/nostr-listener.js

# Terminal 3: Bluesky Jetstream Worker
node scripts/bluesky-listener.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Production Deployment Architecture

```
                               ┌─────────────────────────────┐
                               │       Vercel Platform       │
                               │  • Next.js App Router       │
                               │  • Serverless Ingest APIs   │
                               │  • Static & Edge Assets     │
                               └──────────────┬──────────────┘
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
        ┌─────────────────────────┐                       ┌─────────────────────────┐
        │    Supabase Postgres    │                       │     Render / Railway    │
        │ • articles table        │                       │  • nostr-listener.js    │
        │ • sources table         │                       │  • bluesky-listener.js  │
        │ • Realtime Publication  │                       │  (Persistent Workers)   │
        └─────────────────────────┘                       └─────────────────────────┘
```

1. **Web App & APIs (Vercel)**:
   - Import the repository into Vercel.
   - Configure environment variables from `.env.local`.
2. **Background Workers (Render / Railway)**:
   - Create a **Background Worker** service pointing to `scripts/nostr-listener.js` and `scripts/bluesky-listener.js`.
   - Set `NEXT_PUBLIC_APP_URL` to your production Vercel URL.

---

## 📄 License

MIT License — free for educational, research, and crisis-response use.