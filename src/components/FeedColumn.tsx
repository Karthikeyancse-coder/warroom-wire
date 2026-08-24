"use client";

import ArticleCardGrid from "@/components/ArticleCardGrid";
import { useRealtimeFeed } from "@/hooks/useRealtimeFeed";
import { Loader2 } from "lucide-react";
import type { FeedFilters } from "@/types";

interface Props { filters: FeedFilters; }

export default function FeedColumn({ filters }: Props) {
  const { articles, loading, hasMore, loadMore } = useRealtimeFeed(filters);

  return (
    <div className="flex flex-col gap-6">
      <ArticleCardGrid articles={articles} loading={loading && articles.length === 0} />

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="py-2.5 w-full rounded-xl border border-slate-700/60 text-sm text-slate-400 hover:text-white hover:border-sky-600 transition-colors flex items-center justify-center gap-2 bg-slate-900/40 backdrop-blur-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more stories"}
        </button>
      )}
    </div>
  );
}
