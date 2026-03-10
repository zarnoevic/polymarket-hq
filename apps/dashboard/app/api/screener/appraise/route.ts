import { NextResponse } from "next/server";
import { prisma } from "@polymarket-hq/dashboard-prisma";
import OpenAI from "openai";

const DEEP_APPRAISE_PROMPT = `You are an expert market analyst for prediction markets on Polymarket.

Given a prediction market event, perform DEEP RESEARCH using web search. Investigate:
- The underlying question, relevant facts, and historical precedent
- Recent news, expert opinions, and data that bear on the outcome
- Similar past events and their resolutions
- Factors that could swing the outcome either way

Current Polymarket quoted probabilities (what the market believes):
- YES: {quotedYes}%
- NO: {quotedNo}%

Based on your thorough research, output your APPRAISED probabilities and a detailed explanation.

Respond ONLY with valid JSON in this exact format, no other text:
{"appraised_yes": <number 0-100>, "appraised_no": <number 0-100>, "explanation": "<string: detailed reasoning and analysis, cite sources with inline links or [1], [2] style>"}
The two numbers should sum to approximately 100. The explanation must include all relevant sources as URLs.`;

const MINI_APPRAISE_PROMPT = `You are an expert market analyst for prediction markets on Polymarket.

Given a prediction market event, perform research using web search. Investigate:
- The underlying question and relevant facts
- Recent news and data that bear on the outcome
- Factors that could swing the outcome either way

Current Polymarket quoted probabilities (what the market believes):
- YES: {quotedYes}%
- NO: {quotedNo}%

Based on your research, output your APPRAISED probabilities and a concise explanation.

Respond ONLY with valid JSON in this exact format, no other text:
{"appraised_yes": <number 0-100>, "appraised_no": <number 0-100>, "explanation": "<string: concise reasoning and analysis, cite sources with inline links or [1], [2] style>"}
The two numbers should sum to approximately 100. The explanation must include relevant sources as URLs.`;

const REAPPRAISE_PROMPT = `You are checking if RECENT NEWS (since the last appraisal) would change an existing probability assessment of a Polymarket prediction market.

Original appraisal (from deep research):
- Appraised YES: {appraisedYes}%
- Appraised NO: {appraisedNo}%
- Last appraised: {lastAppraised}

Use web search to find any NEW news, events, or developments since the last appraisal that would materially affect the probability of YES or NO.

If you find significant new information that would change the probabilities, output your UPDATED appraisal and explanation.
If nothing material has changed, output the SAME probabilities with a brief explanation stating no material changes.

Respond ONLY with valid JSON in this exact format, no other text:
{"appraised_yes": <number 0-100>, "appraised_no": <number 0-100>, "explanation": "<string: reasoning, cite any new sources as URLs>"}
The two numbers should sum to approximately 100.`;

function parseAppraisalJson(
  text: string
): { appraised_yes: number; appraised_no: number; explanation?: string } | null {
  const cleaned = text.replace(/```json?\s*|\s*```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const yes = parseFloat(parsed.appraised_yes ?? parsed.appraisedYes);
    const no = parseFloat(parsed.appraised_no ?? parsed.appraisedNo);
    if (isNaN(yes) || isNaN(no)) return null;
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation : undefined;
    return { appraised_yes: yes / 100, appraised_no: no / 100, explanation };
  } catch {
    return null;
  }
}

function extractCitationsFromOutput(output: unknown): string {
  const lines: string[] = [];
  if (!Array.isArray(output)) return "";
  for (const item of output) {
    const msg = item as { type?: string; content?: Array<{ type?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }> };
    if (msg.type !== "message" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      const annotations = (part as { annotations?: Array<{ type?: string; url?: string; title?: string }> }).annotations;
      if (!Array.isArray(annotations)) continue;
      for (let i = 0; i < annotations.length; i++) {
        const a = annotations[i];
        if (a?.type === "url_citation" && a.url) {
          const title = a.title ? ` - ${a.title}` : "";
          lines.push(`[${i + 1}] ${a.url}${title}`);
        }
      }
    }
  }
  if (lines.length === 0) return "";
  return "\n\nSources:\n" + lines.join("\n");
}

function computeYevNev(
  appraisedYes: number,
  appraisedNo: number,
  quotedYes: number | null,
  quotedNo: number | null
): { yev: number | null; nev: number | null } {
  const yev =
    quotedYes != null && quotedYes > 0 ? appraisedYes / quotedYes : null;
  const nev =
    quotedNo != null && quotedNo > 0 ? appraisedNo / quotedNo : null;
  return { yev, nev };
}

type AppraisalMode = "deep" | "mini" | "reappraise" | "think";

async function appraiseOne(
  openai: OpenAI,
  event: Awaited<ReturnType<typeof prisma.screenerEvent.findUnique>>,
  mode: AppraisalMode
): Promise<{ ok: true; appraisedYes: number; appraisedNo: number; yev: number | null; nev: number | null } | { ok: false; error: string }> {
  if (!event) return { ok: false, error: "Event not found" };
  const eventId = event.id;

  if (mode === "reappraise") {
    if (
      event.lastAppraised == null ||
      event.appraisedYes == null ||
      event.appraisedNo == null
    ) {
      return {
        ok: false,
        error: "Reappraise requires a previous deep appraisal (last_appraised must exist)",
      };
    }
  }

  const quotedYes =
    event.probabilityYes != null ? event.probabilityYes * 100 : 50;
  const quotedNo =
    event.probabilityNo != null ? event.probabilityNo * 100 : 50;

  const isReappraise = mode === "reappraise";
  const isDeep = mode === "deep";
  const isMini = mode === "mini";
  const isThink = mode === "think";

  let prompt: string;
  if (isReappraise) {
    prompt = REAPPRAISE_PROMPT.replace(
      "{appraisedYes}",
      ((event.appraisedYes ?? 0) * 100).toFixed(1)
    )
      .replace("{appraisedNo}", ((event.appraisedNo ?? 0) * 100).toFixed(1))
      .replace(
        "{lastAppraised}",
        event.lastAppraised?.toISOString?.() ?? "unknown"
      );
  } else if (isMini) {
    prompt = MINI_APPRAISE_PROMPT.replace("{quotedYes}", quotedYes.toFixed(1))
      .replace("{quotedNo}", quotedNo.toFixed(1));
  } else if (isThink) {
    prompt = DEEP_APPRAISE_PROMPT.replace("{quotedYes}", quotedYes.toFixed(1))
      .replace("{quotedNo}", quotedNo.toFixed(1));
  } else {
    prompt = DEEP_APPRAISE_PROMPT.replace("{quotedYes}", quotedYes.toFixed(1))
      .replace("{quotedNo}", quotedNo.toFixed(1));
  }

  const userMessage = `Event: ${event.title}\n${event.description ? `\nDescription: ${event.description}\n` : ""}\n${prompt}`;

  const model =
    isThink
      ? "gpt-5"
      : isDeep
        ? "o3-deep-research"
        : isMini
          ? "o4-mini-deep-research"
          : "gpt-4o";

  try {
    const response = await openai.responses.create({
      model,
      ...(isThink && { reasoning: { effort: "high" } }),
      input: userMessage,
      instructions:
        "You are a precise market analyst. Output ONLY valid JSON with appraised_yes, appraised_no (0-100), and explanation (string with sources). No other text.",
      tools:
        isReappraise
          ? [{ type: "web_search" as const, search_context_size: "low" as const }]
          : [{ type: "web_search" as const, search_context_size: "medium" as const }],
      text: { format: { type: "text" } },
    });

    const text =
      typeof response.output_text === "string" ? response.output_text : "";
    const parsed = parseAppraisalJson(text);
    if (!parsed) {
      return {
        ok: false,
        error: "Failed to parse appraisal from model",
      };
    }

    const sourcesSuffix = extractCitationsFromOutput(response.output);
    const explanation = parsed.explanation
      ? parsed.explanation + sourcesSuffix
      : sourcesSuffix || null;

    const { yev, nev } = computeYevNev(
      parsed.appraised_yes,
      parsed.appraised_no,
      event.probabilityYes,
      event.probabilityNo
    );

    const appraisalRaw = JSON.parse(
      JSON.stringify({
        mode,
        output_text: text,
        output: response.output,
        usage: response.usage,
      })
    );

    await prisma.screenerEvent.update({
      where: { id: eventId },
      data: {
        appraisedYes: parsed.appraised_yes,
        appraisedNo: parsed.appraised_no,
        lastAppraised: new Date(),
        yev,
        nev,
        appraisalExplanation: explanation,
        appraisalRaw,
      },
    });

    return {
      ok: true,
      appraisedYes: parsed.appraised_yes,
      appraisedNo: parsed.appraised_no,
      yev,
      nev,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

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
    const { eventId, eventIds, mode } = body as {
      eventId?: string;
      eventIds?: string[];
      mode: "deep" | "mini" | "reappraise" | "think";
    };

    const ids: string[] = eventIds?.length
      ? eventIds
      : eventId
        ? [eventId]
        : [];

    if (!ids.length || !mode) {
      return NextResponse.json(
        { error: "eventId, eventIds, and mode (deep|mini|reappraise|think) required (provide eventId or eventIds)" },
        { status: 400 }
      );
    }

    const events = await prisma.screenerEvent.findMany({
      where: { id: { in: ids } },
    });
    const eventMap = new Map(events.map((e) => [e.id, e]));

    const results = await Promise.all(
      ids.map(async (id) => {
        const event = eventMap.get(id);
        const result = await appraiseOne(openai, event ?? null, mode);
        return { eventId: id, ...result };
      })
    );

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;

    if (ids.length === 1) {
      const r = results[0];
      if (!r.ok) {
        const err = r as { ok: false; error: string };
        return NextResponse.json({ error: err.error }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        appraisedYes: r.appraisedYes,
        appraisedNo: r.appraisedNo,
        yev: r.yev,
        nev: r.nev,
      });
    }

    return NextResponse.json({
      ok: true,
      results,
      summary: { ok: okCount, failed: failCount },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Appraise error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
