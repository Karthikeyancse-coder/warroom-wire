"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, ExternalLink, Radio } from "lucide-react";
import clsx from "clsx";
import type { Article, ArticleTier, SourceType } from "@/types";

// ─── Style Maps ───────────────────────────────────────────────────────────────

const TIER_STYLES: Record<ArticleTier, string> = {
  breaking: "bg-red-600 text-white",
  major:    "bg-amber-600 text-white",
  standard: "bg-brand-600 text-white",
  minor:    "bg-surface-muted text-gray-500 dark:text-gray-400",
};

const SOURCE_BADGE: Record<SourceType, { label: string; color: string }> = {
  gdelt:   { label: "GDELT",   color: "text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30" },
  reddit:  { label: "Reddit",  color: "text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30" },
  rss:     { label: "RSS",     color: "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30" },
  bluesky: { label: "Bluesky", color: "text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30" },
  nostr:   { label: "Nostr",   color: "text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30" },
  manual:  { label: "Manual",  color: "text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30" },
};

const MAX_LIVE_ITEMS = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLatency(publishedAt: string): string {
  try {
    const diffMs = Date.now() - new Date(publishedAt).getTime();
    if (diffMs < 0) return "just now";
    if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`;
    return `${Math.round(diffMs / 86_400_000)}d ago`;
  } catch {
    return "—";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveArticle extends Article {
  verified?: boolean;
  _isNew?: boolean;
}

// ─── Live Feed Item ────────────────────────────────────────────────────────────

function LiveFeedItem({ article }: { article: LiveArticle }) {
  const src = SOURCE_BADGE[article.source_type] ?? SOURCE_BADGE.rss;
  const [latency, setLatency] = useState(() => formatLatency(article.published_at));

  // Tick latency every 30s
  useEffect(() => {
    const iv = setInterval(() => setLatency(formatLatency(article.published_at)), 30_000);
    return () => clearInterval(iv);
  }, [article.published_at]);

  return (
    <article
      className={clsx(
        "feed-card animate-fade-in border-l-2 transition-all duration-300",
        article._isNew ? "border-l-green-500 dark:border-l-green-400" : "border-l-transparent",
        article.is_breaking && "ring-1 ring-red-500/30 dark:ring-red-400/20",
      )}
      onClick={() => article.url && window.open(article.url, "_blank", "noopener")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && article.url && window.open(article.url, "_blank")}
    >
      {/* Badge row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx("px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", TIER_STYLES[article.tier])}>
            {article.tier}
          </span>
          <span className={clsx("px-2 py-0.5 rounded text-[10px] font-semibold uppercase border", src.color)}>
            {src.label}
          </span>
          {article.verified && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30">
              <CheckCircle className="w-3 h-3" /> Verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Latency badge */}
          <span className="text-[10px] font-mono text-brand-500 dark:text-brand-400 font-semibold whitespace-nowrap">
            {latency}
          </span>
          {article.url && (
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-brand-500 transition-colors" />
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug mb-1.5 line-clamp-2">
        {article.title}
      </h3>

      {/* Summary */}
      {article.summary && (
        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2 leading-relaxed">
          {article.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-surface-border/50">
        <span className="truncate font-medium">{article.author ?? src.label}</span>
      </div>
    </article>
  );
}

// ─── LiveFeed Component ───────────────────────────────────────────────────────

export default function LiveFeed() {
  const [articles, setArticles] = useState<LiveArticle[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [pushCount, setPushCount] = useState(0);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("articles-realtime-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "articles" },
        (payload) => {
          const newArticle = payload.new as LiveArticle;
          const id = newArticle.id ?? newArticle.external_id ?? "";

          if (!id || seenIds.current.has(id)) return;
          seenIds.current.add(id);

          setPushCount((c) => c + 1);
          setArticles((prev) => {
            const updated = [{ ...newArticle, _isNew: true }, ...prev];
            return updated.slice(0, MAX_LIVE_ITEMS);
          });

          // Clear the "new" highlight after 4s
          setTimeout(() => {
            setArticles((prev) =>
              prev.map((a) => (a.id === newArticle.id ? { ...a, _isNew: false } : a))
            );
          }, 4000);
        }
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <section className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-500 animate-pulse" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
            Live Push Feed
          </h2>
          {pushCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
              +{pushCount} new
            </span>
          )}
        </div>

        {/* Connection status pill */}
        <span
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
            status === "live"
              ? "text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
              : status === "connecting"
              ? "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
              : "text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30"
          )}
        >
          <span
            className={clsx("w-1.5 h-1.5 rounded-full", {
              "bg-green-500 animate-pulse": status === "live",
              "bg-amber-500 animate-pulse": status === "connecting",
              "bg-red-500": status === "error",
            })}
          />
          {status === "live" ? "Realtime Connected" : status === "connecting" ? "Connecting…" : "Disconnected"}
        </span>
      </div>

      {/* Empty state */}
      {articles.length === 0 && (
        <div className="rounded-xl border border-dashed border-surface-border p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <Radio className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Waiting for live events…</p>
          <p className="text-xs mt-1 opacity-70">
            Articles pushed by Nostr/Bluesky firehose workers will appear here instantly.
          </p>
        </div>
      )}

      {/* Feed grid */}
      <div className="flex flex-col gap-3">
        {articles.map((a) => (
          <LiveFeedItem key={a.id ?? a.external_id} article={a} />
        ))}
      </div>
    </section>
  );
}
