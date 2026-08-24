"use client";

import { useEffect, useState } from "react";
import { BarChart2, TrendingUp, Globe, Zap } from "lucide-react";
import type { SourceType } from "@/types";

interface Stats {
  total: number;
  breaking: number;
  bySource: Partial<Record<SourceType, number>>;
  lastHour: number;
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats>({ total: 0, breaking: 0, bySource: {}, lastHour: 0 });

  async function loadStats() {
    try {
      const res = await fetch("/api/articles?stats=true");
      if (res.ok) {
        const data = await res.json();
        setStats({
          total: data.total ?? 0,
          breaking: data.breaking ?? 0,
          lastHour: data.lastHour ?? 0,
          bySource: data.bySource ?? {},
        });
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadStats();
    const iv = setInterval(loadStats, 10_000);
    return () => clearInterval(iv);
  }, []);

  const sourceColors: Record<string, string> = {
    gdelt:   "bg-indigo-500",
    reddit:  "bg-orange-500",
    rss:     "bg-emerald-500",
    bluesky: "bg-sky-500",
    nostr:   "bg-purple-500",
    manual:  "bg-red-500",
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
        <BarChart2 className="w-3.5 h-3.5" /> Feed Stats
      </h3>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Globe,     label: "Total",    value: stats.total,    color: "text-brand-400" },
          { icon: Zap,       label: "Breaking", value: stats.breaking, color: "text-red-400"   },
          { icon: TrendingUp,label: "Last Hour",value: stats.lastHour, color: "text-ok-DEFAULT"},
        ].map((kpi) => (
          <div key={kpi.label} className="glass rounded-xl p-3 col-span-1">
            <kpi.icon className={`w-4 h-4 mb-1 ${kpi.color}`} />
            <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-gray-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* By source */}
      <div className="glass rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">By Source</p>
        <div className="flex flex-col gap-2">
          {Object.entries(stats.bySource).map(([src, count]) => {
            const pct = stats.total > 0 ? Math.round(((count ?? 0) / stats.total) * 100) : 0;
            return (
              <div key={src} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-gray-600 dark:text-gray-400 capitalize">{src}</span>
                <div className="flex-1 bg-surface-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${sourceColors[src] ?? "bg-gray-500"} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-500 font-mono">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Social Firehose note */}
      <div className="glass rounded-xl p-4 border-l-2 border-brand-500">
        <p className="text-xs font-semibold text-brand-400 mb-1">Real-Time Firehoses</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Nostr Relays & Bluesky Jetstream stream live crisis dispatches directly via background workers.
        </p>
      </div>
    </div>
  );
}