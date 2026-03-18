"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

function isPolymarketPath(path: string) {
  return path === "/" || path.startsWith("/analytics") || path.startsWith("/screener") || path.startsWith("/knowledge-base") || path.startsWith("/math");
}

export function RefreshOnVisibility() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!isPolymarketPath(pathname)) return;

      if (pathname.startsWith("/screener")) {
        // Screener has its own refresh with full UI; dispatch so ScreenerContent runs it
        window.dispatchEvent(new CustomEvent("dashboard:refresh-on-visibility"));
        return;
      }

      const refresh = async () => {
        try {
          await fetch("/api/dashboard/refresh", { method: "POST" });
          router.refresh();
        } catch {
          // Silently ignore refresh errors on visibility change
        }
      };

      refresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pathname, router]);

  return null;
}
