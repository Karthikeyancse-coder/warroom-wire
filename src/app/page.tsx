"use client";

import { useState } from "react";
import FeedColumn from "@/components/FeedColumn";
import FilterBar from "@/components/FilterBar";
import PostArticleModal from "@/components/PostArticleModal";
import StatsPanel from "@/components/StatsPanel";
import LiveFeed from "@/components/LiveFeed";
import { PlusCircle, Zap } from "lucide-react";
import { useIngestionPolling } from "@/hooks/useIngestionPolling";
import IngestionHealthStrip from "@/components/IngestionHealthStrip";
import TopNav from "@/components/TopNav";
import BreakingNewsBanner from "@/components/BreakingNewsBanner";
import type { FeedFilters } from "@/types";

const DEFAULT_FILTERS: FeedFilters = {
  search: "",
  tiers: [],
  sources: [],
  since: "24h",
};

export default function HomePage() {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const { statuses } = useIngestionPolling();

  return (
    <div className="min-h-screen flex flex-col bg-[#070b11] transition-colors duration-200">
      {/* ── Navigation ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <TopNav />
        <BreakingNewsBanner />
        <IngestionHealthStrip statuses={statuses} />
      </div>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">

          {/* Header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <span className="live-dot" />
                War-Room Wire
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Real-time intelligence aggregation · GDELT · Reddit · RSS · Bluesky · Nostr
              </p>
            </div>
            <button
              id="post-breaking-btn"
              onClick={() => setPostModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-sm shadow-lg shadow-red-600/25 transition-all duration-200"
            >
              <Zap className="w-4 h-4" />
              Post Breaking Intel
            </button>
          </div>

          {/* ── Sticky filter bar ─────────────────────────────── */}
          <div className="sticky top-[var(--nav-height,120px)] z-30 backdrop-blur-md bg-slate-950/70 rounded-xl border border-slate-800/60 px-4 py-2.5">
            <FilterBar filters={filters} onChange={setFilters} />
          </div>

          {/* ── Feed layout ───────────────────────────────────── */}
          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              {/* Supabase Realtime push feed */}
              <LiveFeed />
              {/* Polled / historical card grid */}
              <FeedColumn filters={filters} />
            </div>

            {/* Sidebar — visible on xl+ */}
            <aside className="w-72 shrink-0 hidden xl:block sticky top-[var(--nav-height,160px)] max-h-[calc(100vh-180px)] overflow-y-auto">
              <StatsPanel />
            </aside>
          </div>

          {postModalOpen && (
            <PostArticleModal onClose={() => setPostModalOpen(false)} />
          )}
        </div>
      </main>
    </div>
  );
}