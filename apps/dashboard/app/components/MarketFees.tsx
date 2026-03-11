"use client";

import { useState, useEffect } from "react";

const CLOB_BASE = "https://clob.polymarket.com";

type FeeResponse = { base_fee?: number };

export function MarketFees({ yesId, noId }: { yesId: string | null; noId: string | null }) {
  const [yesFee, setYesFee] = useState<number | null>(null);
  const [noFee, setNoFee] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!yesId && !noId) {
      setYesFee(null);
      setNoFee(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const fetches: Promise<void>[] = [];
    if (yesId) {
      fetches.push(
        fetch(`${CLOB_BASE}/fee-rate?token_id=${encodeURIComponent(yesId)}`)
          .then((r) => r.json())
          .then((res: FeeResponse) => {
            if (!cancelled) setYesFee(typeof res.base_fee === "number" ? res.base_fee : null);
          })
          .catch(() => {
            if (!cancelled) setYesFee(null);
          })
      );
    } else {
      setYesFee(null);
    }
    if (noId) {
      fetches.push(
        fetch(`${CLOB_BASE}/fee-rate?token_id=${encodeURIComponent(noId)}`)
          .then((r) => r.json())
          .then((res: FeeResponse) => {
            if (!cancelled) setNoFee(typeof res.base_fee === "number" ? res.base_fee : null);
          })
          .catch(() => {
            if (!cancelled) setNoFee(null);
          })
      );
    } else {
      setNoFee(null);
    }
    Promise.all(fetches).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [yesId, noId]);

  if (loading) {
    return (
      <p className="font-mono font-medium text-slate-500">…</p>
    );
  }

  if (yesFee == null && noFee == null) return <p className="font-mono font-medium text-slate-500">—</p>;

  const formatFee = (fee: number | null) =>
    fee != null ? `${(fee * 100).toFixed(2)}%` : "—";

  const bothZero = (yesFee === 0 || yesFee == null) && (noFee === 0 || noFee == null);

  if (bothZero) {
    return <p className="font-mono font-medium text-slate-300 tabular-nums">0</p>;
  }

  return (
    <div
      className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-slate-800/60 px-2 py-1 ring-1 ring-slate-700/50 text-[10px]"
      title="Maker fee rate per outcome"
    >
      <span className="text-slate-400">
        YES Fee <span className="font-mono text-emerald-400/90">{formatFee(yesFee)}</span>
      </span>
      <span className="text-slate-400">
        NO Fee <span className="font-mono text-red-400/90">{formatFee(noFee)}</span>
      </span>
    </div>
  );
}
