"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function CopyAddress({
  address,
  href,
}: {
  address: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback ignored
    }
  }

  const addressEl = (
    <span className="font-mono text-sm text-slate-500">{shortAddress(address)}</span>
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-indigo-400 transition-colors"
        >
          {addressEl}
        </a>
      ) : (
        addressEl
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-300"
        title="Copy address"
        aria-label="Copy address"
      >
        {copied ? (
          <span className="text-xs text-emerald-400">Copied</span>
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}
