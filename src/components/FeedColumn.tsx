"use client";

import FeedCard from "@/components/FeedCard";
import { useRealtimeFeed } from "@/hooks/useRealtimeFeed";
import { Loader2, RefreshCw } from "lucide-react";
import type { FeedFilters } from "@/types";

interface Props { filters: FeedFilters; }

export default function FeedColumn({ filters }: Props) {
  const { articles, loading, hasMore, loadMore } = useRealtimeFeed(filters);

  if (loading && !articles.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <span className="text-sm">Loading feed…</span>
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-3">
        <RefreshCw className="w-8 h-8" />
        <p className="text-sm font-medium">No articles yet</p>
        <p className="text-xs text-center max-w-xs">
          Keep a tab open — the ingestion polling will fetch articles from GDELT and RSS within the next 90 seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* New-article count badge would go here via realtime subscription */}
      {articles.map((article) => (
        <FeedCard key={article.id} article={article} />
      ))}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mt-2 py-2.5 w-full rounded-xl border border-surface-border text-sm text-gray-400 hover:text-white hover:border-brand-600 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
        </button>
      )}
    </div>
  );
}
