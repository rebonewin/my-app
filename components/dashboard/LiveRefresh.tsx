"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the server-rendered dashboard on an interval. This is a soft
 * refresh: React re-renders the page from fresh server data without a browser
 * reload, so scores, asset counters and recent scans stay current while the
 * analyst is reading.
 */
export function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), seconds * 1_000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);

  return null;
}
