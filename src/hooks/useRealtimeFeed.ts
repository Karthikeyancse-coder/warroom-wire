"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Article, FeedFilters } from "@/types";

const PAGE_SIZE = 30;

function buildUrl(filters: FeedFilters, page: number): string {
  const params = new URLSearchParams();
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  if (filters.search)        params.set("search",  filters.search);
  if (filters.tiers.length)  params.set("tiers",   filters.tiers.join(","));
  if (filters.sources.length)params.set("sources", filters.sources.join(","));
  if (filters.since !== "all") {
    const ms: Record<string, number> = { "1h": 3600e3, "6h": 21600e3, "24h": 86400e3, "7d": 604800e3 };
    params.set("since", new Date(Date.now() - ms[filters.since]).toISOString());
  }
  return `/api/articles?${params}`;
}

export function useRealtimeFeed(filters: FeedFilters) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(0);
  const [hasMore,  setHasMore]  = useState(true);
  const seenIds = useRef(new Set<string>());

  const fetchPage = useCallback(
    async (pageNum: number, replace = false) => {
      setLoading(true);
      try {
        const res  = await fetch(buildUrl(filters, pageNum));
        const data: Article[] = await res.json();
        setArticles((prev) => {
          const next = replace ? data : [...prev, ...data];
          seenIds.current = new Set(next.map((a) => a.id));
          return next;
        });
        setHasMore(data.length === PAGE_SIZE);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filters)]
  );

  // Refetch page 0 on filter change
  useEffect(() => {
    setPage(0);
    seenIds.current = new Set();
    fetchPage(0, true);
  }, [fetchPage]);

  // Supabase Realtime channel subscription
  useEffect(() => {
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("articles-realtime-feed")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "articles" },
          (payload) => {
            const fresh = payload.new as Article;
            if (fresh && !seenIds.current.has(fresh.id)) {
              setArticles((prev) => {
                const next = [fresh, ...prev];
                seenIds.current.add(fresh.id);
                return next;
              });
            }
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch {}
      };
    } catch {
      // Supabase connection optional
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic polling fallback (every 10s)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res  = await fetch(buildUrl(filters, 0));
        const data: Article[] = await res.json();
        const fresh = data.filter((a) => !seenIds.current.has(a.id));
        if (fresh.length) {
          setArticles((prev) => {
            const next = [...fresh, ...prev].slice(0, 200);
            seenIds.current = new Set(next.map((a) => a.id));
            return next;
          });
        }
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  return { articles, loading, hasMore, loadMore };
}