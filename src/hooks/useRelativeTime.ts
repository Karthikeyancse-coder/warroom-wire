"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";

/**
 * useRelativeTime
 * Re-computes the relative age every 5 seconds so live feed timestamps
 * never look frozen or stale.
 */
export function useRelativeTime(dateString: string): string {
  const [relativeTime, setRelativeTime] = useState<string>(() => {
    try {
      return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true });
    } catch {
      return "just now";
    }
  });

  useEffect(() => {
    function update() {
      try {
        const date = new Date(dateString);
        const diffMs = Date.now() - date.getTime();
        // If less than 5 seconds ago, display "just now"
        if (diffMs < 5000 && diffMs >= 0) {
          setRelativeTime("just now");
          return;
        }
        setRelativeTime(formatDistanceToNowStrict(date, { addSuffix: true }));
      } catch {
        setRelativeTime("just now");
      }
    }

    update();
    const interval = setInterval(update, 5000); // ticks every 5 seconds
    return () => clearInterval(interval);
  }, [dateString]);

  return relativeTime;
}