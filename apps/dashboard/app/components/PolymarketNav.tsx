"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";

function isPolymarketPath(path: string) {
  return path === "/" || path.startsWith("/analytics") || path.startsWith("/screener") || path.startsWith("/knowledge-base");
}

export function PolymarketNav() {
  const pathname = usePathname();
  if (!isPolymarketPath(pathname)) return null;
  return <Nav />;
}
