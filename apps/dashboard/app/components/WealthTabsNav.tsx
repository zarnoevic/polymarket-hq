"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { TrendingUp, Coins, ArrowLeftRight, LayoutDashboard, BarChart3, Filter, BookOpen } from "lucide-react";

const BIG_CATEGORIES = [
  { href: "/", label: "Polymarket", logo: "/polymarket-icon.png" },
  { href: "/stocks", label: "Stocks", icon: TrendingUp },
  { href: "/gold", label: "Gold", icon: Coins },
  { href: "/fx", label: "FX", icon: ArrowLeftRight },
] as const;

const POLYMARKET_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
] as const;

// Placeholder for other categories - add items as needed
const STOCKS_NAV_ITEMS: readonly { href: string; label: string; icon: typeof LayoutDashboard }[] = [];
const GOLD_NAV_ITEMS: readonly { href: string; label: string; icon: typeof LayoutDashboard }[] = [];
const FX_NAV_ITEMS: readonly { href: string; label: string; icon: typeof LayoutDashboard }[] = [];

function isPolymarketPath(path: string) {
  return path === "/" || path.startsWith("/analytics") || path.startsWith("/screener") || path.startsWith("/knowledge-base");
}

function getCategoryNavItems(path: string) {
  if (isPolymarketPath(path)) return POLYMARKET_NAV_ITEMS;
  if (path === "/stocks" || path.startsWith("/stocks/")) return STOCKS_NAV_ITEMS;
  if (path === "/gold" || path.startsWith("/gold/")) return GOLD_NAV_ITEMS;
  if (path === "/fx" || path.startsWith("/fx/")) return FX_NAV_ITEMS;
  return [];
}

export function WealthTabsNav() {
  const pathname = usePathname();

  const rightNavItems = getCategoryNavItems(pathname);

  return (
    <nav className="border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-sm">
      <div className="flex w-full items-center justify-between gap-6 px-6 py-3 flex-nowrap overflow-x-auto">
        {/* Left: big categories — flush left */}
        <div className="flex shrink-0 gap-1 whitespace-nowrap">
          {BIG_CATEGORIES.map((tab) => {
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

        {/* Center: Wealth HQ */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
        >
          <Image src="/logo.svg" alt="" width={28} height={28} className="rounded-lg" />
          Wealth HQ
        </Link>

        {/* Right: category-specific sub-nav — flush right, no wrap */}
        <div className="flex shrink-0 gap-1 whitespace-nowrap">
          {rightNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
