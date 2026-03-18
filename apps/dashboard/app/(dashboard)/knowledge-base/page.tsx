"use client";

import { useState, useMemo } from "react";
import {
  getSourcesByTheater,
  getCategoriesForTheater,
} from "@/lib/knowledge-base-data";
import {
  KnowledgeBaseSourceCard,
  useKnowledgeBaseState,
} from "@/app/components/KnowledgeBaseSourceCard";

type TheaterTab = "iranian" | "russian" | "chinese";

const theaterTabs: { tab: TheaterTab; label: string }[] = [
  { tab: "iranian", label: "🇮🇷 Iranian Theater" },
  { tab: "russian", label: "🇷🇺 Russian Theater" },
  { tab: "chinese", label: "🇨🇳 Chinese Theater" },
];

const emojiPrefix = /^[\p{Emoji}\s]+/u;

/** Flags for category headers that reference countries/regions */
const categoryFlags: Record<string, string> = {
  "Iran-Iraq War": "🇮🇷 🇮🇶",
  "Iraq War": "🇮🇶",
  "Gulf Wars": "🇮🇶 🇸🇦",
  Israel: "🇮🇱",
  Ukraine: "🇺🇦",
  Taiwan: "🇹🇼",
  "Hong Kong": "🇭🇰",
  "US Relations": "🇺🇸",
  "Sino-Japanese": "🇨🇳 🇯🇵",
  Regional: "🌍",
};

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<TheaterTab>("iranian");
  const { state, setRead, setNote } = useKnowledgeBaseState();

  const sources = useMemo(
    () => getSourcesByTheater(activeTab),
    [activeTab]
  );
  const categories = useMemo(
    () => getCategoriesForTheater(activeTab),
    [activeTab]
  );

  const sourcesByCategory = useMemo(() => {
    const map = new Map<string, typeof sources>();
    for (const cat of categories) {
      map.set(cat, sources.filter((s) => s.category === cat));
    }
    return map;
  }, [sources, categories]);

  return (
    <div className="min-h-screen bg-[rgb(var(--background-rgb))]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(230,230,225,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(230,230,225,.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-beige">Knowledge Base</h1>
          <p className="mt-1 text-slate-400">
            Information wars: Ukrainian war, Iran/Middle East, Taiwan. Wikipedia & books with read tracking and notes.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700/60 bg-slate-800/40 p-0.5">
          {theaterTabs.map(({ tab, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-slate-700/60 text-beige"
                  : "text-slate-400 hover:bg-slate-700/60 hover:text-beige"
              }`}
            >
              <span className="text-lg leading-none">{label.match(emojiPrefix)?.[0] ?? ""}</span>
              <span>{label.replace(emojiPrefix, "").trim()}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50 shadow-xl shadow-black/20 backdrop-blur-sm">
          <div className="border-b border-slate-700/50 px-6 py-4">
            <div>
                <h2 className="text-lg font-semibold text-beige">
                  {theaterTabs.find((t) => t.tab === activeTab)?.label ?? activeTab}
                </h2>
                <p className="text-sm text-slate-400">
                  Sources to understand information wars & historical context
                </p>
            </div>
          </div>
          <div className="px-6 py-6">
            <div className="space-y-8">
              {categories.map((category) => (
                <div key={category}>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {categoryFlags[category] && (
                      <span className="text-base leading-none">{categoryFlags[category]}</span>
                    )}
                    {category}
                  </h3>
                  <div className="space-y-3">
                    {sourcesByCategory.get(category)?.map((source) => (
                      <KnowledgeBaseSourceCard
                        key={source.id}
                        source={source}
                        read={state.read[source.id] ?? false}
                        note={state.notes[source.id] ?? ""}
                        onReadChange={setRead}
                        onNoteChange={setNote}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
