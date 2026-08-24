"use client";

import { useEffect, useState } from "react";
import { Activity, Rss, Radio, Sun, Moon, Sparkles } from "lucide-react";

export default function TopNav() {
  const [clock, setClock] = useState<string>("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem("wrw_theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }

    function tick() {
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("wrw_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border bg-surface-subtle/95 backdrop-blur-md transition-colors duration-200">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-gray-900 dark:text-white leading-tight">
                War‑Room <span className="text-brand-500 font-black">Wire</span>
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 dark:text-gray-400 hidden sm:block">
                Real-Time Crisis Intel Feed
              </span>
            </div>
          </div>
          
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold tracking-wide">
            <span className="live-dot" />
            LIVE
          </span>
        </div>

        {/* Right: Telemetry & Theme Toggle */}
        <div className="flex items-center gap-3 sm:gap-5">
          
          {/* Active status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-muted border border-surface-border text-xs text-gray-600 dark:text-gray-300 font-medium">
            <Activity className="w-3.5 h-3.5 text-brand-500 animate-pulse" />
            <span>Multi-Source Ingestion</span>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-muted border border-surface-border">
            <Rss className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-gray-700 dark:text-gray-300 font-mono text-xs font-semibold">
              {clock || "00:00:00"}
            </span>
          </div>

          {/* Dark / Light Mode Toggle Button */}
          {mounted && (
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-xl bg-surface-muted hover:bg-brand-500/10 border border-surface-border text-gray-700 dark:text-gray-300 hover:text-brand-500 transition-all duration-200 flex items-center justify-center shadow-sm"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-200 hover:-rotate-12" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}