"use client";

import { useState, useEffect } from "react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { FXHistoricalChart } from "./FXHistoricalChart";

type FXData = {
  rate: number;
  percentile: number;
};

type HistoryPoint = { date: string; rate: number };

export function FXTab() {
  const [data, setData] = useState<FXData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/fx/eur-rsd").then((r) => r.json()),
      fetch("/api/fx/eur-rsd/history").then((r) => r.json()),
    ])
      .then(([rateData, histData]) => {
        if (rateData.error) throw new Error(rateData.error);
        setData({ rate: rateData.rate, percentile: rateData.percentile });
        let hist = Array.isArray(histData?.history) ? histData.history : [];
        const today = new Date().toISOString().slice(0, 10);
        if (hist.length > 0 && hist[hist.length - 1]?.date !== today) {
          hist = [...hist, { date: today, rate: rateData.rate }];
        }
        setHistory(hist);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to fetch"))
      .finally(() => setLoading(false));
  }, []);

  const getRecommendation = () => {
    if (data == null) return null;
    const p = data.percentile;
    if (p <= 25)
      return {
        label: "Good time to buy EUR",
        desc: "RSD is relatively strong. Converting RSD → EUR now gets you more euros.",
        icon: TrendingDown,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
      };
    if (p >= 75)
      return {
        label: "Good time to sell EUR",
        desc: "EUR is relatively strong. Converting EUR → RSD now gets you more dinars.",
        icon: TrendingUp,
        color: "text-amber-400",
        bg: "bg-amber-500/15",
      };
    return {
      label: "Average conditions",
      desc: "Rate is in the middle of the typical range. Neither particularly favorable to buy nor sell.",
      icon: Minus,
      color: "text-slate-400",
      bg: "bg-slate-500/15",
    };
  };

  const rec = getRecommendation();

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 shadow-xl">
        <div className="border-b border-slate-700/50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-beige">
            <ArrowLeftRight className="h-5 w-5 text-indigo-400" />
            EUR / RSD
          </h2>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-slate-400">Loading…</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : data ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 text-center">
                <p className="text-sm text-slate-500">Current rate</p>
                <p className="mt-1 text-3xl font-bold text-beige">
                  1 EUR = {data.rate.toFixed(2)} RSD
                </p>
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <p className="mb-2 text-xs text-slate-500">
                  Percentile vs typical range (lower = cheaper EUR, higher = more expensive EUR)
                </p>
                <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${data.percentile}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {data.percentile.toFixed(1)}th percentile
                </p>
              </div>

              {rec && (
                <div
                  className={`flex items-start gap-4 rounded-xl border border-slate-700/50 p-4 ${rec.bg}`}
                >
                  {(() => {
                    const Icon = rec.icon;
                    return <Icon className={`h-6 w-6 shrink-0 ${rec.color}`} />;
                  })()}
                  <div>
                    <p className={`font-semibold ${rec.color}`}>{rec.label}</p>
                    <p className="mt-1 text-sm text-slate-400">{rec.desc}</p>
                  </div>
                </div>
              )}

              <FXHistoricalChart
                history={(
                  () => {
                    const today = new Date().toISOString().slice(0, 10);
                    const last = history[history.length - 1];
                    if (history.length > 0 && last && last.date < today) {
                      return [...history, { date: today, rate: data.rate }];
                    }
                    return history;
                  }
                )()}
                currentRate={data.rate}
                className="mt-4"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
