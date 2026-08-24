-- =============================================================================
-- War-Room Wire — Complete Supabase PostgreSQL Schema & Seed
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- =============================================================================

-- Enable pg_trgm for full-text / trigram headline search
create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------
-- 1. sources table: tracks data sources and ingestion health
-- -----------------------------------------------------------------------
create table if not exists public.sources (
  id                     uuid        primary key default gen_random_uuid(),
  name                   text        not null unique,
  type                   text        not null,               -- gdelt | reddit | rss | bluesky | manual
  url                    text,
  status                 text        not null default 'ok',  -- ok | unavailable | degraded | pending
  last_fetched_at        timestamptz,
  fetch_interval_seconds int         not null default 60,
  config                 jsonb       not null default '{}',
  created_at             timestamptz not null default now()
);

-- Seed built-in sources
insert into public.sources (name, type, fetch_interval_seconds, status) values
  ('gdelt',       'gdelt',   90, 'ok'),
  ('reddit',      'reddit',  45, 'ok'),
  ('rss',         'rss',     60, 'ok'),
  ('bluesky',     'bluesky', 0,  'ok'),
  ('nostr',       'nostr',   0,  'ok'),
  ('BBC World',   'rss',     60, 'ok'),
  ('Reuters Top', 'rss',     60, 'ok'),
  ('AP Top News', 'rss',     60, 'ok'),
  ('Hacker News', 'rss',     60, 'ok'),
  ('TechCrunch',  'rss',     60, 'ok'),
  ('The Guardian','rss',     60, 'ok'),
  ('Al Jazeera',  'rss',     60, 'ok')
on conflict (name) do update set status = 'ok';

-- -----------------------------------------------------------------------
-- 2. articles table: unified aggregated feed
-- -----------------------------------------------------------------------
create table if not exists public.articles (
  id           uuid        primary key default gen_random_uuid(),
  source_id    uuid        references public.sources(id) on delete set null,
  source_type  text        not null,                        -- gdelt | reddit | rss | bluesky | manual
  external_id  text        unique,                          -- dedup key
  title        text        not null,
  summary      text,
  url          text,
  author       text,
  published_at timestamptz not null default now(),          -- Real publication timestamp from publisher
  ingested_at  timestamptz not null default now(),          -- Pipeline fetch timestamp
  tier         text        not null default 'standard',     -- breaking | major | standard | minor
  tags         text[]      not null default '{}',
  is_breaking  boolean     not null default false,
  is_manual    boolean     not null default false,
  score        int         not null default 0,
  metadata     jsonb       not null default '{}',
  created_at   timestamptz not null default now()
);

-- Add columns if table already existed without them
alter table public.articles add column if not exists ingested_at    timestamptz not null default now();
alter table public.articles add column if not exists content_hash   text unique;
alter table public.articles add column if not exists verified       boolean not null default false;

-- Indexes for lightning fast feed queries
create index if not exists articles_published_at_idx  on public.articles (published_at desc);
create index if not exists articles_ingested_at_idx   on public.articles (ingested_at desc);
create index if not exists articles_tier_idx          on public.articles (tier);
create index if not exists articles_source_type_idx   on public.articles (source_type);
create index if not exists articles_is_breaking_idx   on public.articles (is_breaking) where is_breaking = true;
create index if not exists articles_title_trgm_idx    on public.articles using gin (title gin_trgm_ops);
create index if not exists articles_content_hash_idx  on public.articles (content_hash) where content_hash is not null;
create index if not exists articles_verified_idx      on public.articles (verified) where verified = true;

-- Enable Supabase Realtime on articles table (idempotent — safe to re-run)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'articles'
  ) then
    alter publication supabase_realtime add table public.articles;
  end if;
end $$;

-- -----------------------------------------------------------------------
-- 3. Seed initial breaking & major articles
-- -----------------------------------------------------------------------
insert into public.articles (source_type, external_id, title, summary, url, author, published_at, ingested_at, tier, tags, is_breaking, is_manual, score)
values
  (
    'manual',
    'seed_1',
    'Global Supply Chain Alert: Key Maritime Corridor Experiences Critical Congestion',
    'Critical shipping lanes report severe bottlenecks following emergency port maintenance and severe weather disruptions across major trade routes.',
    'https://news.ycombinator.com',
    'War-Room Desk',
    now() - interval '5 minutes',
    now() - interval '3 minutes',
    'breaking',
    array['breaking', 'logistics', 'supply-chain'],
    true,
    true,
    100
  ),
  (
    'rss',
    'seed_2',
    'International Renewable Energy Output Reaches Record High in Q3',
    'Grid operators across Europe and Asia register highest sustained solar and wind generation levels to date, lowering fossil peak reliance.',
    'https://www.reuters.com',
    'Reuters',
    now() - interval '4 hours',
    now() - interval '5 minutes',
    'major',
    array['energy', 'climate', 'economy'],
    false,
    false,
    45
  ),
  (
    'gdelt',
    'seed_3',
    'Central Banks Signal Coordinated Liquidity Protocol Revisions',
    'Financial authorities convene to review automated high-frequency liquidity backstops ahead of fiscal quarter transitions.',
    'https://www.bloomberg.com',
    'bloomberg.com',
    now() - interval '6 hours',
    now() - interval '8 minutes',
    'major',
    array['markets', 'banking', 'finance'],
    false,
    false,
    30
  ),
  (
    'reddit',
    'seed_4',
    'Cybersecurity Researchers Uncover Novel Zero-Day Affecting Core Infrastructure Firmwares',
    'Patches deployed rapidly after proof-of-concept demonstration by security teams at international conference.',
    'https://reddit.com/r/worldnews',
    'u/NetSecWatch',
    now() - interval '2 hours',
    now() - interval '10 minutes',
    'standard',
    array['security', 'tech', 'cyber'],
    false,
    false,
    850
  ),
  (
    'rss',
    'seed_5',
    'Autonomous Logistics Fleet Completes First Cross-Border Heavy Haul Test',
    'Electric freight transports travel over 1,200 km without human intervention under strict regulatory monitoring.',
    'https://techcrunch.com',
    'TechCrunch',
    now() - interval '8 hours',
    now() - interval '14 minutes',
    'standard',
    array['tech', 'ai', 'transport'],
    false,
    false,
    20
  )
on conflict (external_id) do nothing;

-- -----------------------------------------------------------------------
-- 4. Row Level Security (RLS) policies
-- -----------------------------------------------------------------------
alter table public.articles enable row level security;
alter table public.sources  enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Allow public select articles" on public.articles;
drop policy if exists "Allow public insert articles" on public.articles;
drop policy if exists "Allow public update articles" on public.articles;
drop policy if exists "Allow public select sources"  on public.sources;
drop policy if exists "Allow public update sources"  on public.sources;
drop policy if exists "Allow public insert sources"  on public.sources;

create policy "Allow public select articles" on public.articles for select using (true);
create policy "Allow public insert articles" on public.articles for insert with check (true);
create policy "Allow public update articles" on public.articles for update using (true);

create policy "Allow public select sources"  on public.sources for select using (true);
create policy "Allow public insert sources"  on public.sources for insert with check (true);
create policy "Allow public update sources"  on public.sources for update using (true);

-- -----------------------------------------------------------------------
-- 6. Atomic ingestion lock function
-- -----------------------------------------------------------------------
create or replace function public.claim_source_lock(
  p_name                text,
  p_min_interval_seconds int
) returns boolean
language plpgsql security definer as $$
declare
  rows_updated int;
begin
  update public.sources
  set    last_fetched_at = now()
  where  name = p_name
    and  (
           last_fetched_at is null
           or last_fetched_at < now() - (p_min_interval_seconds || ' seconds')::interval
         );

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;