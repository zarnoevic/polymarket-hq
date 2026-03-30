import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTS: Parameters<typeof sanitizeHtml>[1] = {
  allowedTags: ["h1", "h2", "h3", "p", "strong", "em", "blockquote", "ul", "ol", "li", "code", "a", "br"],
  allowedAttributes: { "*": ["class"], a: ["href", "target", "rel", "class"] },
};

/** Converts markdown to styled HTML. Use for appraisal, rules, blindspots. */
export function formatReportMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<") && trimmed.includes(">")) return sanitizeHtml(trimmed, SANITIZE_OPTS);

  const raw = marked.parse(trimmed, { async: false }) as string;
  let html = raw
    .replace(/<h1>/g, '<h1 class="font-semibold text-slate-200 text-base border-b border-slate-600/60 pb-2 mb-4">')
    .replace(/<h2>/g, '<h2 class="font-semibold text-slate-200 text-sm mt-5 mb-2">')
    .replace(/<h3>/g, '<h3 class="font-semibold text-slate-200 text-sm mt-3 mb-1.5">')
    .replace(/<p>/g, '<p class="text-slate-300 leading-relaxed my-2">')
    .replace(/<strong>/g, '<strong class="text-slate-100 font-semibold">')
    .replace(/<em>/g, '<em class="text-amber-200/90">')
    .replace(/<blockquote>/g, '<blockquote class="border-l-2 border-amber-500/50 bg-amber-500/5 py-0.5 px-3 rounded-r text-slate-300 font-normal my-3">')
    .replace(/<ul>/g, '<ul class="my-2 list-disc pl-5">')
    .replace(/<ol>/g, '<ol class="my-2 list-decimal pl-5">')
    .replace(/<li>/g, '<li class="my-0.5">')
    .replace(/<code>/g, '<code class="rounded bg-slate-700/50 px-1 py-0.5 text-xs text-slate-300">')
    .replace(/<a /g, '<a class="text-amber-400 hover:text-amber-300 underline" ');

  return sanitizeHtml(html, SANITIZE_OPTS);
}
