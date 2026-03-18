"use client";

import { useState, ReactNode } from "react";
import { BarChart3, TrendingUp, Coins, ArrowLeftRight } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  polymarket: BarChart3,
  stocks: TrendingUp,
  gold: Coins,
  fx: ArrowLeftRight,
};

type TabDef = {
  id: string;
  label: string;
  icon: keyof typeof ICONS;
  content: ReactNode;
};

export function WealthTabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <div className="flex w-full flex-col">
      <div className="border-b border-slate-800/60 bg-slate-900/30 px-6 py-2">
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon }) => {
            const Icon = ICONS[icon] ?? BarChart3;
            return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                active === id
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-beige"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {tabs.map((tab) =>
          tab.id === active ? (
            <div key={tab.id} className="contents">
              {tab.content}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
