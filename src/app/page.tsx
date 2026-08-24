"use client";

import { useState } from "react";
import FeedColumn from "@/components/FeedColumn";
import FilterBar from "@/components/FilterBar";
import PostArticleModal from "@/components/PostArticleModal";
import StatsPanel from "@/components/StatsPanel";
import LiveFeed from "@/components/LiveFeed";
import { PlusCircle } from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-surface transition-colors duration-200">
      <TopNav />
      <BreakingNewsBanner />
      <IngestionHealthStrip statuses={statuses} />

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Header row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
                <span className="live-dot" />
                Live Intelligence Feed
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Real-time aggregation pipeline from GDELT, Reddit, RSS & Bluesky
              </p>
            </div>
            <button
              id="post-breaking-btn"
              onClick={() => setPostModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-sm shadow-lg shadow-red-600/20 transition-all duration-200"
            >
              <PlusCircle className="w-4 h-4" />
              Post Breaking News
            </button>
          </div>

          {/* Filters */}
          <FilterBar filters={filters} onChange={setFilters} />

          {/* Two-column feed + stats sidebar */}
          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              {/* Real-time Supabase Realtime push feed */}
              <LiveFeed />
              {/* Polled / historical feed */}
              <FeedColumn filters={filters} />
            </div>
            <aside className="w-80 shrink-0 hidden xl:block">
              <StatsPanel />
            </aside>
          </div>

          {/* Manual article posting modal */}
          {postModalOpen && (
            <PostArticleModal onClose={() => setPostModalOpen(false)} />
          )}
        </div>
      </main>
    </div>
  );
}