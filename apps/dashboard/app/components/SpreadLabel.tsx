"use client";

import { useState, useEffect } from "react";

const CLOB_BASE = "https://clob.polymarket.com";

type OrderBookEntry = { price: string; size: string };

type OrderBookResponse = { bids?: OrderBookEntry[]; asks?: OrderBookEntry[] };

export function SpreadLabel({ tokenId }: { tokenId: string | null }) {
  const [spread, setSpread] = useState<number | null | "loading">("loading");

  useEffect(() => {
    if (!tokenId?.trim()) return;
    let cancelled = false;
    fetch(`${CLOB_BASE}/book?token_id=${encodeURIComponent(tokenId)}`)
      .then((r) => r.json())
      .then((res: OrderBookResponse) => {
        if (cancelled) return;
        const bids = (res.bids ?? []).map((b) => parseFloat(b.price)).filter((p) => Number.isFinite(p)).sort((a, b) => b - a);
        const asks = (res.asks ?? []).map((a) => parseFloat(a.price)).filter((p) => Number.isFinite(p)).sort((a, b) => a - b);
        const buy = asks[0] ?? 0;
        const sell = bids[0] ?? 0;
        setSpread(buy > 0 && sell > 0 ? buy - sell : 0);
      })
      .catch(() => {
        if (!cancelled) setSpread(null);
      });
    return () => { cancelled = true; };
  }, [tokenId]);

  if (!tokenId) return null;
  if (spread === "loading") return <p className="font-mono font-medium text-slate-500">…</p>;
  if (spread == null || spread <= 0) return <p className="font-mono font-medium text-slate-500">—</p>;

  return (
    <p className="font-mono font-medium text-slate-300 tabular-nums">
      {(spread * 100).toFixed(1)}¢
    </p>
  );
}
