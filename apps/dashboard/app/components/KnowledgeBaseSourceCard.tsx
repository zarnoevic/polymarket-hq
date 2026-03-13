"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, BookOpen, Check, FileText } from "lucide-react";
import type { KnowledgeSource } from "@/lib/knowledge-base-data";

const STORAGE_KEY = "polymarket-knowledge-base";

type StoredState = {
  read: Record<string, boolean>;
  notes: Record<string, string>;
};

function loadState(): StoredState {
  if (typeof window === "undefined") return { read: {}, notes: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { read: {}, notes: {} };
    const parsed = JSON.parse(raw);
    return {
      read: parsed?.read && typeof parsed.read === "object" ? parsed.read : {},
      notes: parsed?.notes && typeof parsed.notes === "object" ? parsed.notes : {},
    };
  } catch {
    return { read: {}, notes: {} };
  }
}

function saveState(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

type Props = {
  source: KnowledgeSource;
  read: boolean;
  note: string;
  onReadChange: (id: string, read: boolean) => void;
  onNoteChange: (id: string, note: string) => void;
};

export function KnowledgeBaseSourceCard({
  source,
  read,
  note,
  onReadChange,
  onNoteChange,
}: Props) {
  const [notesExpanded, setNotesExpanded] = useState(!!note);
  const [localNote, setLocalNote] = useState(note);

  useEffect(() => {
    setLocalNote(note);
  }, [note]);

  const handleNoteBlur = useCallback(() => {
    if (localNote !== note) onNoteChange(source.id, localNote);
  }, [localNote, note, source.id, onNoteChange]);

  const isWikipedia = source.type === "wikipedia";

  return (
    <div className="group rounded-lg border border-slate-700/60 bg-slate-800/30 p-4 transition-colors hover:border-slate-600/60">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onReadChange(source.id, !read)}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            read
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
              : "border-slate-500 bg-transparent text-slate-500 hover:border-slate-400 hover:text-slate-400"
          }`}
          aria-label={read ? "Mark as unread" : "Mark as read"}
        >
          {read && <Check className="h-4 w-4" strokeWidth={2.5} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isWikipedia && source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-indigo-400 hover:text-indigo-300"
              >
                <FileText className="h-4 w-4" />
                {source.title}
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            ) : (
              <span className={`font-medium ${read ? "text-slate-400 line-through" : "text-white"}`}>
                {source.title}
              </span>
            )}
            {!isWikipedia && source.author && (
              <span className="text-sm text-slate-500">
                {source.author}
                {source.year && ` (${source.year})`}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{source.category}</p>

          {notesExpanded ? (
            <div className="mt-3">
              <textarea
                value={localNote}
                onChange={(e) => setLocalNote(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder="Add notes..."
                rows={2}
                className="w-full resize-y rounded-md border border-slate-600/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
              <button
                type="button"
                onClick={() => setNotesExpanded(false)}
                className="mt-1 text-xs text-slate-500 hover:text-slate-400"
              >
                Collapse notes
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNotesExpanded(true)}
              className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {note ? "Edit notes" : "Add notes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useKnowledgeBaseState() {
  const [state, setState] = useState<StoredState>(loadState);

  useEffect(() => {
    setState(loadState());
  }, []);

  const setRead = useCallback((id: string, read: boolean) => {
    setState((prev) => {
      const next = {
        ...prev,
        read: { ...prev.read, [id]: read },
      };
      saveState(next);
      return next;
    });
  }, []);

  const setNote = useCallback((id: string, note: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        notes: { ...prev.notes, [id]: note },
      };
      saveState(next);
      return next;
    });
  }, []);

  return { state, setRead, setNote };
}
