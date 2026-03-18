"use client";

import { TrendingUp } from "lucide-react";

export function StocksTab() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-500">
        <TrendingUp className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-beige">Stocks</h3>
      <p className="mt-2 text-slate-400">Coming soon.</p>
    </div>
  );
}
