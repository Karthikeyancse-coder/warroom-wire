"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Article } from "@/types";

export default function BreakingNewsBanner() {
  const [breaking,  setBreaking]  = useState<Article[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function fetchBreaking() {
    try {
      const res  = await fetch("/api/articles?breaking=true&limit=5");
      const data: Article[] = await res.json();
      if (Array.isArray(data)) setBreaking(data);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchBreaking();
    const id = setInterval(fetchBreaking, 15_000);
    return () => clearInterval(id);
  }, []);

  const visible = breaking.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="bg-red-900/30 border-b border-red-600/50">
      {visible.map((art) => (
        <div
          key={art.id}
          className="container mx-auto max-w-screen-2xl px-4 py-2 flex items-center gap-3 text-sm animate-slide-in"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="font-bold text-red-400 uppercase tracking-wider text-xs shrink-0">
            Breaking
          </span>
          <span className="text-white font-medium truncate flex-1">{art.title}</span>
          {art.url && (
            <a href={art.url} target="_blank" rel="noopener noreferrer"
              className="text-brand-400 hover:underline text-xs shrink-0">
              Read →
            </a>
          )}
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, art.id]))}
            className="text-gray-500 hover:text-white shrink-0 ml-1"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}