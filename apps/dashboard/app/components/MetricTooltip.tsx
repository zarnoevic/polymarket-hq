"use client";

import { HelpCircle } from "lucide-react";
import { useState, useRef, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";

type MetricTooltipProps = {
  content: string;
  /** When provided, this label is the hover target (e.g. "ROI") instead of the ? icon. */
  trigger?: ReactNode;
};

export function MetricTooltip({ content, trigger }: MetricTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, placement: "top" as "top" | "bottom" });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePositionAndShow = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const placement = window.innerHeight - rect.bottom >= rect.top ? "bottom" : "top";
    const x = rect.left + rect.width / 2;
    const y = placement === "top" ? rect.top - 8 : rect.bottom + 8;
    setCoords({ x, y, placement });
    setVisible(true);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => setVisible(false), 80);
  }, []);

  const lines = content.split("\n").filter((l) => l.trim());

  const tooltipContent = visible && typeof document !== "undefined" && (
    <div
      role="tooltip"
      className="fixed z-[9999] w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2"
      style={{
        left: coords.x,
        top: coords.placement === "top" ? "auto" : coords.y,
        bottom: coords.placement === "top" ? `calc(100vh - ${coords.y}px)` : "auto",
        animation: "metricTooltipFadeIn 0.05s ease-out",
      }}
      onMouseEnter={updatePositionAndShow}
      onMouseLeave={scheduleHide}
    >
      <div className="rounded-xl border border-slate-600/60 bg-slate-800/98 px-4 py-3.5 shadow-2xl shadow-black/60 ring-1 ring-beige/5 backdrop-blur-md">
        <div className="space-y-2.5 text-[13px] leading-relaxed">
          {lines.map((line, i) => {
            if (line.startsWith("What:")) {
              return (
                <p key={i} className="text-beige">
                  <span className="font-semibold text-indigo-400">What:</span>{" "}
                  {line.replace(/^What:\s*/, "").trim()}
                </p>
              );
            }
            if (line.startsWith("Ranges:")) {
              return (
                <p key={i} className="text-slate-300">
                  <span className="font-semibold text-emerald-400/90">Ranges:</span>{" "}
                  {line.replace(/^Ranges:\s*/, "").trim()}
                </p>
              );
            }
            if (line.startsWith("Calculation:") || line.startsWith("Formula:")) {
              return (
                <p key={i} className="font-mono text-xs leading-snug text-slate-400">
                  <span className="font-semibold text-amber-400/90">Formula:</span>{" "}
                  {line.replace(/^(Calculation|Formula):\s*/, "").trim()}
                </p>
              );
            }
            return null;
          })}
        </div>
        {/* Arrow */}
        <div
          className={`absolute left-1/2 h-0 w-0 -translate-x-1/2 border-[6px] border-transparent ${
            coords.placement === "top"
              ? "top-full border-t-slate-800"
              : "bottom-full border-b-slate-800"
          }`}
          style={
            coords.placement === "top"
              ? { top: "100%", marginTop: "-1px" }
              : { bottom: "100%", marginBottom: "-1px" }
          }
        />
      </div>
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex shrink-0"
        onMouseEnter={updatePositionAndShow}
        onMouseLeave={scheduleHide}
      >
        {trigger != null ? (
          <span className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-1 transition-colors hover:decoration-indigo-400 hover:text-indigo-400">
            {trigger}
          </span>
        ) : (
          <span className="cursor-help text-slate-500 transition-colors hover:text-indigo-400">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
      {typeof document !== "undefined" && tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
}
