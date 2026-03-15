"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { TrendingUp, Coins, ArrowLeftRight } from "lucide-react";

const WEALTH_TABS = [
  { href: "/", label: "Polymarket", logo: "/polymarket-icon.png" },
  { href: "/stocks", label: "Stocks", icon: TrendingUp },
  { href: "/gold", label: "Gold", icon: Coins },
  { href: "/fx", label: "FX", icon: ArrowLeftRight },
] as const;

function isPolymarketPath(path: string) {
  return path === "/" || path.startsWith("/analytics") || path.startsWith("/screener") || path.startsWith("/knowledge-base");
}

export function WealthTabsNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
        >
          <Image src="/logo.svg" alt="" width={28} height={28} className="rounded-lg" />
          Wealth HQ
        </Link>
        <div className="flex gap-1">
          {WEALTH_TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? isPolymarketPath(pathname)
                : pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                {"logo" in tab ? (
                  <Image
                    src={tab.logo}
                    alt=""
                    width={16}
                    height={16}
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                ) : (
                  <tab.icon className="h-4 w-4 shrink-0 object-contain" />
                )}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
