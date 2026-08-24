"use client";

import { useState } from "react";
import { X, Send, AlertTriangle } from "lucide-react";
import type { ArticleTier } from "@/types";

interface Props { onClose: () => void; }

export default function PostArticleModal({ onClose }: Props) {
  const [title,   setTitle]   = useState("");
  const [summary, setSummary] = useState("");
  const [url,     setUrl]     = useState("");
  const [tier,    setTier]    = useState<ArticleTier>("breaking");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/articles", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title, summary, url, tier }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to post");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl w-full max-w-lg animate-slide-in shadow-2xl border border-surface-border">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Post Breaking News</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Inject live demo event into the aggregate stream</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-surface-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="article-title" className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Headline *
            </label>
            <input
              id="article-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Critical Infrastructure Outage Reported Across Region..."
              className="px-3.5 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="article-summary" className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Summary / Briefing
            </label>
            <textarea
              id="article-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Detailed intelligence briefing or situational overview…"
              rows={3}
              className="px-3.5 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="article-url" className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Source URL
              </label>
              <input
                id="article-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="px-3.5 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:border-brand-500 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="article-tier" className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Urgency Tier
              </label>
              <select
                id="article-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as ArticleTier)}
                className="px-3.5 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-500 transition-all font-semibold"
              >
                <option value="breaking">🚨 Breaking</option>
                <option value="major">⚡ Major</option>
                <option value="standard">📰 Standard</option>
                <option value="minor">📡 Minor</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-surface-border text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-surface-muted text-sm font-semibold transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-red-600/25 transition-all flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              {loading ? "Broadcasting…" : "Broadcast Article"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}