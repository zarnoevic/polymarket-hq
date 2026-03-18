"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

function isPolymarketPath(path: string) {
  return path === "/" || path.startsWith("/analytics") || path.startsWith("/screener") || path.startsWith("/knowledge-base") || path.startsWith("/math");
}

function shouldAutoRefresh(path: string) {
  return isPolymarketPath(path) && !path.startsWith("/screener");
}

const REFRESH_INTERVAL_MS = 15_000;

export function RefreshOnVisibility() {
  const pathname = usePathname();
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doRefresh = async () => {
    try {
      await fetch("/api/dashboard/refresh", { method: "POST" });
      router.refresh();
    } catch {
      // Silently ignore refresh errors
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!shouldAutoRefresh(pathname)) return;
      doRefresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pathname, router]);

  // 15-second interval refresh when dashboard is open and tab is visible
  useEffect(() => {
    if (!shouldAutoRefresh(pathname)) return;

    const tick = () => {
      if (document.visibilityState === "visible") {
        doRefresh();
      }
    };

    intervalRef.current = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pathname, router]);

  return null;
}
