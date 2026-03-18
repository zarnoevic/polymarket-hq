"use client";

import { useState, useCallback, useEffect } from "react";
import { Brain, Plus, FileText, ChevronRight, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

const STORAGE_KEY = "polymarket-ai-analyses";

type AiAnalysis = {
  id: string;
  content: string;
  createdAt: string;
};

function loadAnalyses(): AiAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiAnalysis[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAnalyses(analyses: AiAnalysis[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
  } catch {
    // ignore
  }
}

export function AiAnalysisSection() {
  const [analyses, setAnalyses] = useState<AiAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setAnalyses(loadAnalyses().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = selectedId ? analyses.find((a) => a.id === selectedId) : null;

  const orderNew = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/ai-analysis", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate analysis");
      }

      const { content, createdAt } = data as { content: string; createdAt: string };
      const newAnalysis: AiAnalysis = {
        id: crypto.randomUUID(),
        content,
        createdAt,
      };

      const updated = [newAnalysis, ...analyses];
      setAnalyses(updated);
      saveAnalyses(updated);
      setSelectedId(newAnalysis.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mb-8 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-xl shadow-black/20">
      <div className="border-b border-slate-700/50 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-beige">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Brain className="h-5 w-5" strokeWidth={1.75} />
            </div>
            AI Trading Analyses
          </h3>
          <button
            onClick={orderNew}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Order new analysis
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-rose-400">{error}</p>
        )}
      </div>

      <div className="flex divide-x divide-slate-700/50">
        {/* History list */}
        <div className="min-w-[280px] max-w-[340px] flex-1">
          <div className="max-h-[320px] overflow-y-auto">
            {analyses.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
                <FileText className="h-10 w-10 text-slate-500" />
                <p className="text-sm text-slate-400">No analyses yet</p>
                <p className="text-xs text-slate-500">Click &quot;Order new analysis&quot; to get an AI review of your trading</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {analyses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/50 ${
                      selectedId === a.id ? "bg-indigo-500/10" : ""
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-beige">
                        Analysis
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail pane */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="relative max-h-[420px] overflow-y-auto p-5">
              <button
                onClick={() => setSelectedId(null)}
                className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-beige"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <p className="mb-4 text-xs text-slate-500">
                {formatDate(selected.createdAt)}
              </p>
              <div className="prose prose-invert prose-sm max-w-none prose-headings:text-beige prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-beige">
                <ReactMarkdown>{selected.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-slate-500">
              <FileText className="h-12 w-12 opacity-50" />
              <p className="text-sm">Select an analysis to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
