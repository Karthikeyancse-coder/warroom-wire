"use client";

import { ExternalLink, Star } from "lucide-react";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import clsx from "clsx";
import type { Article, ArticleTier, SourceType } from "@/types";

const TIER_STYLES: Record<ArticleTier, string> = {
  breaking: "bg-red-600 text-white",
  major:    "bg-amber-600 text-white",
  standard: "bg-brand-600 text-white",
  minor:    "bg-surface-muted text-gray-500 dark:text-gray-400",
};

const SOURCE_BADGE: Record<SourceType, { label: string; color: string }> = {
  gdelt:   { label: "GDELT",   color: "text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30" },
  reddit:  { label: "Reddit",  color: "text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30" },
  rss:     { label: "RSS",     color: "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"   },
  bluesky: { label: "Bluesky", color: "text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30"       },
  nostr:   { label: "Nostr",   color: "text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30" },
  manual:  { label: "Manual",  color: "text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"       },
};

interface Props { article: Article; }

export default function FeedCard({ article }: Props) {
  const src = SOURCE_BADGE[article.source_type] ?? SOURCE_BADGE.rss;
  const age = useRelativeTime(article.published_at);

  return (
    <article
      className="feed-card animate-fade-in"
      onClick={() => article.url && window.open(article.url, "_blank", "noopener")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && article.url && window.open(article.url, "_blank")}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx("px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", TIER_STYLES[article.tier])}>
            {article.tier}
          </span>
          <span className={clsx("px-2 py-0.5 rounded text-[10px] font-semibold uppercase border", src.color)}>
            {src.label}
          </span>
          {article.is_manual && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-amber-700 dark:text-yellow-300 border border-amber-300 dark:border-yellow-700/60 bg-amber-50 dark:bg-yellow-950/40">
              <Star className="w-2.5 h-2.5 fill-current" /> Demo Post
            </span>
          )}
        </div>
        {article.url && (
          <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-brand-500 shrink-0 mt-0.5 transition-colors" />
        )}
      </div>

      {/* Title */}
      <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-snug mb-1.5 line-clamp-2">
        {article.title}
      </h2>

      {/* Summary */}
      {article.summary && (
        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2.5 leading-relaxed font-normal">
          {article.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-surface-border/50">
        <span className="truncate font-medium">{article.author ?? src.label}</span>
        <span className="shrink-0 ml-2 font-mono text-[10px] text-brand-500 dark:text-brand-400 font-semibold">
          {age}
        </span>
      </div>

      {/* Tags */}
      {article.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {article.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-md bg-surface-muted text-gray-600 dark:text-gray-400 text-[10px] font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}