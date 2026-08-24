"use client";

import { useState } from "react";
import { ExternalLink, ShieldCheck, Wifi } from "lucide-react";
import clsx from "clsx";
import { sanitizePreview, extractDomain } from "@/lib/sanitize";
import type { Article, ArticleTier, SourceType } from "@/types";

// ─── Style Maps ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  ArticleTier,
  { label: string; bg: string; dot: boolean }
> = {
  breaking: { label: "CRITICAL",  bg: "bg-red-600",              dot: true  },
  major:    { label: "HIGH",       bg: "bg-amber-500",            dot: false },
  standard: { label: "MEDIUM",     bg: "bg-yellow-500 text-slate-900", dot: false },
  minor:    { label: "MINOR",      bg: "bg-sky-600",              dot: false },
};

const SOURCE_CONFIG: Record<SourceType, { label: string; color: string }> = {
  gdelt:   { label: "GDELT",    color: "bg-indigo-600/90" },
  reddit:  { label: "REDDIT",   color: "bg-orange-600/90" },
  rss:     { label: "RSS",      color: "bg-emerald-600/90" },
  bluesky: { label: "BLUESKY",  color: "bg-sky-600/90" },
  nostr:   { label: "NOSTR",    color: "bg-purple-600/90" },
  manual:  { label: "BREAKING", color: "bg-red-600/90" },
};

// ─── Relative Time ───────────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    if (diff < 0) return "just now";
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return `${Math.round(diff / 86_400_000)}d ago`;
  } catch {
    return "—";
  }
}

// ─── Fallback Backdrop ────────────────────────────────────────────────────────

function FallbackBackdrop({ sourceType }: { sourceType: SourceType }) {
  const src = SOURCE_CONFIG[sourceType] ?? SOURCE_CONFIG.rss;
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 flex flex-col items-center justify-center gap-2 select-none">
      <Wifi className="w-8 h-8 text-slate-600 opacity-50" />
      <span className={clsx("text-[10px] font-bold tracking-widest px-2 py-0.5 rounded", src.color, "text-white opacity-70")}>
        {src.label}
      </span>
    </div>
  );
}

// ─── Single Card ─────────────────────────────────────────────────────────────

interface CardProps {
  article: Article & { verified?: boolean };
}

function ArticleCard({ article }: CardProps) {
  const tier   = TIER_CONFIG[article.tier]  ?? TIER_CONFIG.minor;
  const src    = SOURCE_CONFIG[article.source_type] ?? SOURCE_CONFIG.rss;
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!article.image_url && !imgFailed;

  const domain    = extractDomain(article.url, article.author ?? src.label);
  const preview   = sanitizePreview(article.summary, 180);
  const timestamp = relativeTime(article.published_at);

  return (
    <article
      className={clsx(
        "group relative flex flex-col rounded-xl overflow-hidden cursor-pointer",
        "bg-slate-900/70 border border-slate-800/60",
        "hover:border-slate-600/80 hover:shadow-xl hover:shadow-black/40",
        "transition-all duration-300",
        article.tier === "breaking" && "ring-1 ring-red-500/40",
      )}
      onClick={() => article.url && window.open(article.url, "_blank", "noopener")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && article.url && window.open(article.url, "_blank")}
    >
      {/* ── Media Area ─────────────────────────────────────────────── */}
      <div className="relative h-[180px] overflow-hidden shrink-0 bg-slate-950">
        {hasImage ? (
          <img
            src={article.image_url!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          <FallbackBackdrop sourceType={article.source_type} />
        )}

        {/* Dark gradient overlay so badges are always readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

        {/* ── Top-left badges ───────────────────────────────────── */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
          {/* Risk tier badge */}
          <span
            className={clsx(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white shadow-md",
              tier.bg,
            )}
          >
            {tier.dot && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
            )}
            {tier.label}
          </span>

          {/* Source pill */}
          <span
            className={clsx(
              "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider text-white shadow-md",
              src.color,
            )}
          >
            {src.label}
          </span>
        </div>

        {/* ── Top-right verified badge ──────────────────────────── */}
        {article.verified && (
          <div className="absolute top-2.5 right-2.5">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-600/90 text-white shadow-md">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-3.5 gap-2">
        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {article.title}
        </h3>

        {/* Description */}
        {preview && (
          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed flex-1">
            {preview}
          </p>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-slate-500 truncate font-medium">
              {domain}
            </span>
            <span className="text-slate-700 shrink-0">·</span>
            <span className="text-[11px] font-mono text-sky-500 shrink-0 font-semibold whitespace-nowrap">
              {timestamp}
            </span>
          </div>

          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition-all shrink-0"
            >
              Read <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
      <Wifi className="w-10 h-10 text-slate-700 animate-pulse" />
      <p className="text-slate-500 font-medium text-sm">Scanning firehose streams…</p>
      <p className="text-slate-600 text-xs max-w-xs">
        Articles from Nostr, Bluesky, RSS, GDELT and Reddit will appear here as they arrive.
      </p>
    </div>
  );
}

// ─── Grid Component ───────────────────────────────────────────────────────────

interface Props {
  articles: (Article & { verified?: boolean })[];
  loading?: boolean;
}

export default function ArticleCardGrid({ articles, loading = false }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {loading && articles.length === 0 ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-slate-900/40 border border-slate-800/40 h-[320px] animate-pulse"
          />
        ))
      ) : articles.length === 0 ? (
        <EmptyState />
      ) : (
        articles.map((a) => (
          <ArticleCard key={a.id ?? a.external_id} article={a} />
        ))
      )}
    </div>
  );
}
