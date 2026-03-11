"use client";

import { useState, useEffect } from "react";

const CLOB_BASE = "https://clob.polymarket.com";

type OrderBookEntry = { price: string; size: string };

type OrderBookResponse = {
  bids?: OrderBookEntry[];
  asks?: OrderBookEntry[];
};

type OrderBookLabelProps = {
  tokenId: string | null;
  /** When provided, renders the Yes/No bar with spread overlaid on it */
  probabilityYes?: number | null;
  probabilityNo?: number | null;
};

export function OrderBookLabel({ tokenId, probabilityYes, probabilityNo }: OrderBookLabelProps) {
  const [data, setData] = useState<OrderBookResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tokenId?.trim()) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${CLOB_BASE}/book?token_id=${encodeURIComponent(tokenId)}`)
      .then((r) => r.json())
      .then((res: OrderBookResponse) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tokenId]);

  const probYes = probabilityYes ?? 0;
  const probNo = probabilityNo ?? (probabilityYes != null ? 1 - probabilityYes : 0);

  const bids = (data?.bids ?? [])
    .map((b) => parseFloat(b.price))
    .filter((p) => Number.isFinite(p))
    .sort((a, b) => b - a);
  const asks = (data?.asks ?? [])
    .map((a) => parseFloat(a.price))
    .filter((p) => Number.isFinite(p))
    .sort((a, b) => a - b);

  const buyPrice = asks[0] ?? 0;
  const sellPrice = bids[0] ?? 0;
  const spread = buyPrice > 0 && sellPrice > 0 ? buyPrice - sellPrice : 0;
  const spreadPct = spread > 0 ? (spread * 100).toFixed(1) : null;

  const showBar = probabilityYes != null || probabilityNo != null;
  const hasSpread = tokenId && spread > 0;

  // One bar: Yes (green) | gray spread | No (red). Spread proportional to its size.
  const total = probYes + spread + probNo;
  const yesPct = total > 0 ? (probYes / total) * 100 : probYes * 100;
  const spreadPctBar = total > 0 ? (spread / total) * 100 : 0;
  const noPct = total > 0 ? (probNo / total) * 100 : probNo * 100;

  return (
    <div className="flex flex-col gap-2">
      {showBar && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1">Quoted</p>
          <div className="flex justify-between gap-4 text-xs font-medium mb-1.5">
            <span className="text-emerald-600/90 tabular-nums">Yes {(probYes * 100).toFixed(0)}%</span>
            <span className="text-red-600/90 tabular-nums">No {(probNo * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-800/80 ring-1 ring-slate-700/80">
            <div
              className="rounded-l-full min-w-0 bg-emerald-600/70"
              style={{ width: `${yesPct}%` }}
            />
            {hasSpread && (
              <div
                className="min-w-0 bg-slate-700/90"
                style={{ width: `${spreadPctBar}%` }}
                title={`Spread ${spreadPct}¢`}
              />
            )}
            <div
              className="rounded-r-full min-w-0 bg-red-600/70"
              style={{ width: `${noPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
