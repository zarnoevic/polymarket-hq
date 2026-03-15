"use client";

import { useState, useEffect } from "react";
import { Coins, Plus } from "lucide-react";

type GoldHolding = {
  id: string;
  grams: number;
  pricePerGram: number;
  dateBought: string;
};

const STORAGE_KEY = "wealth-hq-gold-holdings";

function loadHoldings(): GoldHolding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHoldings(holdings: GoldHolding[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch {
    // ignore
  }
}

export function GoldTab() {
  const [holdings, setHoldings] = useState<GoldHolding[]>([]);
  const [grams, setGrams] = useState("");
  const [pricePerGram, setPricePerGram] = useState("");
  const [dateBought, setDateBought] = useState("");
  const [currentGoldPrice, setCurrentGoldPrice] = useState<number | null>(null);

  useEffect(() => {
    setHoldings(loadHoldings());
  }, []);

  useEffect(() => {
    fetch("/api/gold/price")
      .then((r) => r.json())
      .then((d) => (d.eurPerGram ? setCurrentGoldPrice(d.eurPerGram) : null))
      .catch(() => null);
  }, []);

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grams);
    const p = parseFloat(pricePerGram);
    if (!g || !p || !dateBought || g <= 0 || p <= 0) return;
    const newHolding: GoldHolding = {
      id: crypto.randomUUID(),
      grams: g,
      pricePerGram: p,
      dateBought,
    };
    const updated = [...holdings, newHolding];
    setHoldings(updated);
    saveHoldings(updated);
    setGrams("");
    setPricePerGram("");
    setDateBought("");
  };

  const costBasis = holdings.reduce((s, h) => s + h.grams * h.pricePerGram, 0);
  const currentValue =
    currentGoldPrice != null
      ? holdings.reduce((s, h) => s + h.grams * currentGoldPrice, 0)
      : null;
  const pnl = currentValue != null ? currentValue - costBasis : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 shadow-xl">
        <div className="border-b border-slate-700/50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Coins className="h-5 w-5 text-amber-400" />
            Gold Portfolio
          </h2>
        </div>

        <form onSubmit={handleAddHolding} className="border-b border-slate-700/50 p-6">
              <h3 className="mb-4 text-sm font-medium text-slate-300">Add gold holding</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Grams</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Price per gram (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={pricePerGram}
                    onChange={(e) => setPricePerGram(e.target.value)}
                    placeholder={currentGoldPrice ? currentGoldPrice.toFixed(2) : "e.g. 66"}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Date bought</label>
                  <input
                    type="date"
                    value={dateBought}
                    onChange={(e) => setDateBought(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>
            </form>

            <div className="p-6">
              {holdings.length === 0 ? (
                <p className="text-slate-500">No gold holdings yet. Add one above.</p>
              ) : (
                <>
                  <div className="mb-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                      <p className="text-xs text-slate-500">Cost basis</p>
                      <p className="text-xl font-semibold text-white">
                        €{costBasis.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                      <p className="text-xs text-slate-500">Current value</p>
                      <p className="text-xl font-semibold text-white">
                        {currentValue != null
                          ? `€${currentValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </p>
                      {currentGoldPrice != null && (
                        <p className="text-xs text-slate-400">
                          €{currentGoldPrice.toFixed(2)}/g
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                      <p className="text-xs text-slate-500">P&L</p>
                      <p
                        className={`text-xl font-semibold ${
                          pnl != null ? (pnl >= 0 ? "text-emerald-400" : "text-red-400") : "text-slate-400"
                        }`}
                      >
                        {pnl != null ? (
                          <>
                            {pnl >= 0 ? "+" : ""}
                            €{pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            {costBasis > 0 &&
                              ` (${((pnl / costBasis) * 100).toFixed(1)}%)`}
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  </div>

                  <h3 className="mb-3 text-sm font-medium text-slate-300">Holdings</h3>
                  <ul className="space-y-2">
                    {holdings.map((h) => {
                      const curVal = currentGoldPrice != null ? h.grams * currentGoldPrice : null;
                      const pnlH = curVal != null ? curVal - h.grams * h.pricePerGram : null;
                      return (
                        <li
                          key={h.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <Coins className="h-5 w-5 text-amber-400" />
                            <div>
                              <p className="font-medium text-white">
                                {h.grams} g @ €{h.pricePerGram.toFixed(2)}/g
                              </p>
                              <p className="text-xs text-slate-500">
                                Bought {new Date(h.dateBought).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-white">
                              {curVal != null
                                ? `€${curVal.toFixed(2)}`
                                : "—"}
                            </p>
                            {pnlH != null && (
                              <p
                                className={`text-xs ${
                                  pnlH >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {pnlH >= 0 ? "+" : ""}
                                €{pnlH.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
      </div>
    </div>
  );
}
