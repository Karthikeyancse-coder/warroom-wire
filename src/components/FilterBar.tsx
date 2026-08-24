"use client";

import { Search, Clock, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import type { FeedFilters, ArticleTier, SourceType } from "@/types";

interface Props {
  filters: FeedFilters;
  onChange: (f: FeedFilters) => void;
}

const TIER_OPTIONS: { value: ArticleTier; label: string }[] = [
  { value: "breaking", label: "Breaking" },
  { value: "major",    label: "Major" },
  { value: "standard", label: "Standard" },
  { value: "minor",    label: "Minor" },
];

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "gdelt",   label: "GDELT" },
  { value: "reddit",  label: "Reddit" },
  { value: "rss",     label: "RSS" },
  { value: "bluesky", label: "Bluesky" },
  { value: "nostr",   label: "Nostr" },
  { value: "manual",  label: "Manual" },
];

const TIME_OPTIONS: { value: FeedFilters["since"]; label: string }[] = [
  { value: "1h",  label: "1h" },
  { value: "6h",  label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d",  label: "7d" },
  { value: "all", label: "All" },
];

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

export default function FilterBar({ filters, onChange }: Props) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3.5 shadow-sm">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id="search-input"
          type="text"
          placeholder="Search headlines, keywords, or topics…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-muted border border-surface-border rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        {/* Left side: Time & Tier filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Time filter */}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex rounded-lg overflow-hidden border border-surface-border bg-surface-muted p-0.5">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  id={`time-filter-${opt.value}`}
                  onClick={() => onChange({ ...filters, since: opt.value })}
                  className={clsx(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                    filters.since === opt.value
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tier filter */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex flex-wrap gap-1.5">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  id={`tier-filter-${opt.value}`}
                  onClick={() => onChange({ ...filters, tiers: toggle(filters.tiers, opt.value) })}
                  className={clsx(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                    filters.tiers.includes(opt.value)
                      ? "bg-brand-600 border-brand-500 text-white shadow-sm"
                      : "border-surface-border bg-surface-muted text-gray-600 dark:text-gray-400 hover:border-brand-500 hover:text-brand-500"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right side: Source filter */}
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              id={`source-filter-${opt.value}`}
              onClick={() => onChange({ ...filters, sources: toggle(filters.sources, opt.value) })}
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                filters.sources.includes(opt.value)
                  ? "bg-brand-500/15 border-brand-500 text-brand-600 dark:text-brand-400 font-bold"
                  : "border-surface-border bg-surface-muted text-gray-600 dark:text-gray-400 hover:border-gray-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}