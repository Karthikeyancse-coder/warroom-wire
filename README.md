# 🛰️ War-Room Wire

> **High-Accuracy, Low-Latency Real-Time Intelligence & Crisis News Aggregation Engine**  
> *Built for high-stakes situational awareness, crisis monitoring, and live intelligence desks.*

---

## ⚡ Overview

**War-Room Wire** is a full-stack real-time intelligence dashboard and ingestion engine. It aggregates breaking news, decentralized social firehoses, government/geopolitical databases, and global RSS feeds into a single unified stream powered by **Supabase PostgreSQL & Realtime** and Next.js 14.

### 🌟 Core Capabilities

* 🌐 **Multi-Stream Firehose Intake**: Ingests continuously from **Nostr Relays**, **Bluesky Jetstream**, **GDELT 2.0 Doc API**, **Reddit WorldNews**, and **7 Global RSS Feeds** (BBC, Reuters, AP, TechCrunch, Hacker News, The Guardian, Al Jazeera).
* 🛡️ **Sub-Second Link & Content Verifier**: Parses target articles server-side using **`cheerio`** within 3.5 seconds to extract primary headlines, canonical URLs, article bodies, and thumbnail media (`og:image`, `twitter:image`). Automatically drops 404s, paywalls, and spam.
* 🔒 **Deterministic Deduplication**: Computes SHA-256 hashes of normalized titles and initial text payloads. Employs a dual-tier dedup model: an in-memory 2-hour rolling LRU cache (5,000 items) + atomic database deduplication (`ON CONFLICT (content_hash) DO NOTHING`).
* ⚡ **Sub-2s Live Push Feed**: Connects frontend clients via Supabase Realtime WebSocket channels (`articles-realtime-feed`) for instant visual insertion with entrance animations.
* ⏱️ **Ingest Latency Telemetry**: Instruments both **Network Latency** (publisher to server arrival) and **Processing Latency** (verification, dedup, triage) displayed directly on crisis cards (`Ingested in 1.4s • Verified ✓`).
* 📰 **High-Density 3-Column Crisis Grid**: Modern responsive card grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) with 180px thumbnail media headers, dark gradient stream backdrops, risk tier badges (Critical, High, Medium, Minor), and text sanitization.
* 🧹 **Noise Sanitizer**: Cleans raw article excerpts by stripping HTML tags, entity codes, audio strings ("Listen 3 mins"), and social syndication noise ("Share on Twitter").
* 🚨 **"Post Breaking Intel" Modal**: Immediate sub-second manual breaking news injection tool for live command room testing.

---

## 📐 Architecture & Pipeline

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           FIREHOSE PRODUCERS                              │
│                                                                           │
│  [ Nostr 4x Relays WS ]     [ Bluesky Jetstream WS ]     [ "Post Breaking │
│    (Background Worker)         (Background Worker)         Intel" Modal ] │
│             │                           │                         │       │
│             └─────────────┬─────────────┘                         │       │
└───────────────────────────┼───────────────────────────────────────┼───────┘
                            ▼                                       │
┌───────────────────────────────────────────────────────────────────┼───────┐
│                      INGESTION & TRIAGE API                       │       │
│                                                                   │       │
│   /api/ingest/nostr  ──┐                                          │       │
│   /api/ingest/bluesky ─┼──> [ Keyword Pre-Filter (<5ms) ]         │       │
│   /api/ingest/gdelt  ──┤                 │                        │       │
│   /api/ingest/rss    ──┤                 ▼                        │       │
│   /api/ingest/reddit ──┘    [ Link Verifier & Cheerio ]           │       │
│                                (3.5s timeout, Paywall Drop,       │       │
│                                 Image & Canonical Extract)        │       │
│                                          │                        │       │
│                                          ▼                        │       │
│                             [ SHA-256 Deduplication ]             │       │
│                               (LRU Cache + DB Conflict)           │       │
│                                          │                        │       │
│                                          ▼                        │       │
│                             [ Telemetry Latency Calc ]            │       │
└──────────────────────────────────────────┬────────────────────────┴───────┘
                                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           PERSISTENCE & REALTIME                          │
│                                                                           │
│                    [ Supabase PostgreSQL + pg_trgm ]                      │
│                                    │                                      │
│                    [ Supabase Realtime Publication ]                      │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                              │
│                                                                           │
│   [ <LiveFeed /> ] ─────────> Instant WebSocket Prepend + Latency Pill    │
│   [ <ArticleCardGrid /> ] ──> 3-Column Crisis Grid with 180px Thumbnails  │
│   [ <BreakingNewsBanner /> ]> High-Priority Ticker                        │
│   [ <IngestionHealthStrip />] Real-time Status of All Ingestion Routes    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Sources & Ingestion Modes

| Source | Method | Polling / Stream | Role & Quality Filter |
|---|---|---|---|
| **Nostr** | Standalone Node.js WS Worker | Real-time Stream (`since: now`) | Decentralized crisis reports across 4 relays (`damus.io`, `nos.lol`, `snort.social`, `nostr.mom`) |
| **Bluesky** | Standalone Node.js WS Worker | Jetstream Firehose | AT Protocol commit stream filtered by 20+ crisis keywords |
| **GDELT 2.0** | Server-side Ingest Route | 90-second In-browser Poller | Global geopolitical conflict and emergency event monitoring |
| **RSS Feeds** | `Promise.allSettled` Route | 60-second In-browser Poller | 7 top-tier news wires (BBC, Reuters, AP, TechCrunch, HN, Guardian, Al Jazeera) |
| **Reddit** | Server-side Ingest Route | 45-second In-browser Poller | r/worldnews and security communities |
| **Manual Desk** | HTTP POST API Modal | On-Demand (Sub-2s) | Manual injection of breaking command intel |

---

## 🛠️ Technology Stack

* **Framework**: Next.js 14 (App Router), React 18, TypeScript
* **Styling**: Tailwind CSS, Lucide Icons, Glassmorphism UI tokens (`globals.css`)
* **HTML Parsing & Extraction**: `cheerio`
* **Database & Realtime**: Supabase PostgreSQL, Row-Level Security (RLS), Trigram Search (`pg_trgm`), `supabase_realtime` Publication
* **Hashing & Encryption**: Node.js `crypto` (SHA-256)
* **Firehose Clients**: `ws` (WebSocket) with auto-reconnect backoff

---

## 📁 Repository Structure

```
warroom-wire/
├── scripts/
│   ├── nostr-listener.js       # Standalone Nostr firehose listener with auto-reconnect
│   └── bluesky-listener.js     # Standalone Bluesky Jetstream listener with auto-reconnect
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── articles/route.ts      # GET (paginated/filtered feed), POST (manual breaking news)
│   │   │   ├── ingest/
│   │   │   │   ├── bluesky/route.ts   # Bluesky ingest + verify + dedup + telemetry
│   │   │   │   ├── nostr/route.ts     # Nostr ingest + verify + dedup + telemetry
│   │   │   │   ├── gdelt/route.ts     # GDELT 2.0 doc ingest with 6s timeout & fallback
│   │   │   │   ├── rss/route.ts       # RSS Promise.allSettled 7-feed concurrent ingest
│   │   │   │   └── reddit/route.ts    # Reddit worldnews ingest
│   │   │   └── sources/route.ts       # Ingestion health and source registry
│   │   ├── globals.css                # Glassmorphism tokens, ticker animations, dark/light vars
│   │   ├── layout.tsx                 # Root layout with Inter font
│   │   └── page.tsx                   # Main War-Room dashboard
│   ├── components/
│   │   ├── ArticleCardGrid.tsx        # High-density 3-column crisis card grid
│   │   ├── LiveFeed.tsx               # Supabase Realtime live subscriber feed
│   │   ├── BreakingNewsBanner.tsx     # Animated ticker for critical breaking news
│   │   ├── FeedColumn.tsx             # Paginated feed wrapper
│   │   ├── FilterBar.tsx              # Risk tier, source, and timespan filtering
│   │   ├── IngestionHealthStrip.tsx   # Live telemetry status pill strip
│   │   ├── PostArticleModal.tsx       # "Post Breaking Intel" modal dialog
│   │   ├── StatsPanel.tsx             # Real-time analytics breakdown
│   │   └── TopNav.tsx                 # Sticky navigation with theme toggle & UTC clock
│   ├── hooks/
│   │   ├── useIngestionPolling.ts     # Browser poller for RSS/GDELT/Reddit
│   │   ├── useRealtimeFeed.ts         # Query & state management for feed
│   │   └── useRelativeTime.ts         # Client-side dynamic relative timestamp updater
│   ├── lib/
│   │   ├── verify-article.ts          # Link validator, cheerio parser & thumbnail extractor
│   │   ├── dedupe.ts                  # SHA-256 hasher & 2-hour rolling LRU cache
│   │   ├── sanitize.ts                # HTML tag & social noise sanitizer
│   │   ├── keywords.ts                # Shared crisis & emergency dictionary
│   │   ├── store.ts                   # In-memory fallback cache & seed data
│   │   └── supabase/                  # Browser, server, and service-role clients
│   └── types/
│       └── index.ts                   # Unified Article, Source, and Telemetry types
└── supabase/
    └── schema.sql                     # Complete idempotent PostgreSQL schema & RLS policies
```

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js 18.x or 20.x
* A free [Supabase](https://supabase.com) project

### 2. Clone and Install Dependencies

```bash
git clone https://github.com/Karthikeyancse-coder/warroom-wire.git
cd warroom-wire
npm install
```

### 3. Configure Environment Variables

Create `.env.local` in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Internal Ingestion Authentication
NOSTR_INGEST_SECRET=demo_nostr_secret_key

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Setup Database Schema

Open your Supabase project dashboard → **SQL Editor** → **New Query**, copy the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.

> **Note**: The schema is 100% idempotent and can be safely executed multiple times without dropping data or crashing on existing publication bindings.

### 5. Run the Application

#### Terminal 1 — Next.js Web App:
```bash
npm run dev
```

#### Terminal 2 — Nostr Real-Time Firehose Worker:
```bash
node scripts/nostr-listener.js
```

#### Terminal 3 — Bluesky Jetstream Firehose Worker:
```bash
node scripts/bluesky-listener.js
```

Visit [http://localhost:3000](http://localhost:3000) to view the live dashboard.

---

## 🧪 Production Deployment

### Frontend (Vercel)
1. Push your repository to GitHub.
2. Import project into Vercel.
3. Add the environment variables from `.env.local`.
4. Deploy!

### Background Workers (Render / Railway)
Because firehoses require persistent WebSockets, run the listeners as background workers:
1. **Render**: Create **New + > Background Worker**.
   - Build Command: `npm install`
   - Start Command: `node scripts/nostr-listener.js` (or `node scripts/bluesky-listener.js`)
   - Add `NEXT_PUBLIC_APP_URL` and `NOSTR_INGEST_SECRET`.
2. **Railway**: Deploy as a service with start command `node scripts/nostr-listener.js`.

---

## 📜 License

MIT License. Designed and engineered for live crisis awareness and hackathon presentations.