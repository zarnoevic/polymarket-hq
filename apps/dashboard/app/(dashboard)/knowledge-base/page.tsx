"use client";

import { useState } from "react";
import { Globe, MapPin } from "lucide-react";

type TheaterTab = "iranian" | "russian" | "chinese";

const theaterTabs: { tab: TheaterTab; label: string }[] = [
  { tab: "iranian", label: "Iranian Theater" },
  { tab: "russian", label: "Russian Theater" },
  { tab: "chinese", label: "Chinese Theater" },
];

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<TheaterTab>("iranian");

  return (
    <div className="min-h-screen bg-[rgb(var(--background-rgb))]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Knowledge Base</h1>
          <p className="mt-1 text-slate-400">
            Geopolitical theater briefings and analysis
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700/60 bg-slate-800/40 p-0.5">
          {theaterTabs.map(({ tab, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-slate-700/60 text-white"
                  : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <MapPin className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-xl shadow-black/20 backdrop-blur-sm">
          <div className="border-b border-slate-700/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                <Globe className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {theaterTabs.find((t) => t.tab === activeTab)?.label ?? activeTab}
                </h2>
                <p className="text-sm text-slate-400">
                  Overview and key developments
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-6">
            {activeTab === "iranian" && (
              <div className="space-y-4 text-slate-300">
                <p>Iranian Theater content coming soon.</p>
              </div>
            )}
            {activeTab === "russian" && (
              <div className="space-y-4 text-slate-300">
                <p>Russian Theater content coming soon.</p>
              </div>
            )}
            {activeTab === "chinese" && (
              <div className="space-y-4 text-slate-300">
                <p>Chinese Theater content coming soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
