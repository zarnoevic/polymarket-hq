import { NextResponse } from "next/server";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@polymarket-hq/dashboard-prisma";
import OpenAI from "openai";

const ID_PATTERN = /^[a-z]+_[a-f0-9]{20,}$/i;

/** Converts markdown to styled HTML and sanitizes. Used for blindspots report. */
function formatBlindspotsReport(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  // Add Tailwind classes via regex replacements for report styling
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

  return sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "p", "strong", "em", "blockquote", "ul", "ol", "li", "code", "a", "br"],
    allowedAttributes: { "*": ["class"], a: ["href", "target", "rel", "class"] },
  });
}

function extractTextFromOutput(output: unknown): string {
  const texts: string[] = [];
  if (!Array.isArray(output)) return "";
  for (const item of output) {
    const msg = item as { type?: string; content?: unknown[] };
    if (!Array.isArray(msg?.content)) continue;
    for (const part of msg.content) {
      const p = part as Record<string, unknown>;
      const s = (p?.text ?? p?.content ?? p?.output) as string | undefined;
      if (typeof s === "string" && s.length > 50 && !ID_PATTERN.test(s))
        texts.push(s);
    }
  }
  return texts.join("").trim();
}

const RULES_ANALYSIS_PROMPT = `You are an expert at analyzing prediction market resolution rules. Your job is to identify BLINDSPOTS—things traders commonly overlook that could cost them money or cause resolution disputes.

Given the resolution rules (description) of a Polymarket prediction market, perform a thorough analysis focused on blindspots: hidden risks, non-obvious interpretations, and pitfalls that even careful readers might miss.

Focus specifically on:

1. **Blindspots & hidden risks**: What could a trader easily overlook when reading these rules? What non-obvious scenarios might cause YES/NO to resolve differently than expected? Think like a contrarian: what would surprise most people?

2. **Ambiguities**: Which phrases, terms, or conditions could reasonably be interpreted in multiple ways? Quote the exact text and explain each interpretation. These are often blindspots—traders assume one meaning.

3. **Edge cases**: What marginal or borderline scenarios might arise that the rules don't explicitly address? When could the outcome be disputed? Traders often forget to consider these.

4. **Potential misunderstandings**: How might a casual (or even careful) reader misinterpret the rules? What common assumptions might lead someone to the wrong conclusion about YES vs NO?

5. **Missing definitions**: What key terms are used without being defined? (e.g., "official", "confirmed", "major", specific dates, sources that count) These definition gaps are blindspots that create resolution risk.

When the market resolves is NEVER ambiguous—Polymarket defines the end date; do not flag this.

You are analyzing the market as-is. We have no power to change it. Do NOT suggest alternative wording, rephrasings, or "improved" resolution clauses. Do NOT include a recommendations section that proposes text changes. Focus only on identifying risks and ambiguities in the existing rules.

Be thorough and precise. Quote the rules verbatim when discussing specific ambiguities. Emphasize what traders are most likely to miss.

Format your response as a professional report document. Structure:

- Start with a brief **Executive Summary** (2–4 sentences).
- Use numbered sections: 1. Blindspots & Hidden Risks, 2. Ambiguities, 3. Edge Cases, 4. Potential Misunderstandings, 5. Missing Definitions, 6. Temporal/Source Ambiguities.
- Use > blockquotes when quoting rules verbatim.
- Use **bold** for key terms, *italic* for emphasis.
- Use ### for subsection headers within each numbered section.
- Use - for bullet points. Keep paragraphs concise.
- End with a brief **Key Takeaways** if helpful.

Do not truncate—provide the complete analysis.

Do NOT include meta-offers or follow-up suggestions such as "If you want, I can draft...", "Would you like me to...", "I can help with...", or offers to propose replacement clauses. Only output the analysis itself.`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    const body = await req.json();
    const { eventId } = body as { eventId?: string };
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "eventId required" },
        { status: 400 }
      );
    }

    const event = await prisma.screenerEvent.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const rules = event.description?.trim();
    if (!rules) {
      return NextResponse.json(
        { error: "Event has no rules/description to analyze" },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      reasoning: { effort: "medium" },
      max_output_tokens: 8000,
      instructions: RULES_ANALYSIS_PROMPT,
      input: `Market question: ${event.title}\n\nResolution rules:\n\n${rules}`,
      text: { format: { type: "text" } },
    });

    let rulesAnalysis = extractTextFromOutput(response.output);
    if (!rulesAnalysis && typeof (response as { output_text?: string }).output_text === "string") {
      const ot = (response as { output_text: string }).output_text.trim();
      if (ot.length > 50 && !ID_PATTERN.test(ot)) rulesAnalysis = ot;
    }
    if (!rulesAnalysis) {
      return NextResponse.json(
        { error: "Empty analysis from model" },
        { status: 500 }
      );
    }

    const formattedAnalysis = formatBlindspotsReport(rulesAnalysis);
    const now = new Date();
    await prisma.screenerEvent.update({
      where: { id: eventId },
      data: {
        rulesAnalysis: formattedAnalysis,
        rulesAnalysisAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      rulesAnalysis: formattedAnalysis,
      rulesAnalysisAt: now.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Analyze rules error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
