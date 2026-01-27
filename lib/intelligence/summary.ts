import "server-only";

import { runOpenAIChat } from "@/lib/intelligence/openaiClient";
import { packInsightsForPrompt } from "@/lib/intelligence/taskInsights";
import type { TaskInsights } from "@/lib/intelligence/taskInsights";

const SUMMARY_SYSTEM_PROMPT = [
  "You are Intelligence Desk, an executive operations analyst for a marketing organization.",
  "Use only the provided data pack. If data is missing, say you do not have it.",
  "Use task description snippets and latest comment snippets for context.",
  "Pay special attention to dependency summaries and blocked chains.",
  "Write in plain, simple language for a 1-second skim.",
  "Be concise, high-signal, and avoid filler."
].join(" ");

const SUMMARY_USER_PROMPT = [
  "Return JSON only. No markdown, no extra text.",
  "Return a single-line JSON object using only standard double quotes.",
  "Schema:",
  "{",
  '  "headline": string (<= 90 chars),',
  '  "snapshot": string[] (max 3 items, each <= 12 words),',
  '  "blockers": Array<{ "task": string, "reason": string, "dependency": string } | string> (max 3),',
  '  "priorities": string[] (max 3),',
  '  "risks": string[] (max 3),',
  '  "next_actions": string[] (max 3, action verbs)',
  "}",
  "Rules:",
  "- If data is missing, use 'unknown'.",
  "- Keep items short and skimmable.",
  "- Focus on blockers, risks, and urgent priorities.",
  "- Do not include newlines inside string values.",
  "- Do not use smart quotes or trailing commas."
].join("\n");

function stripCodeFence(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function sanitizeJsonText(raw: string) {
  return raw
    .replace(/^[\uFEFF\u200B\u200C\u200D]+/, "")
    .replace(/\u0000/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function extractJsonBlock(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function normalizeSummaryJson(raw: string) {
  const cleaned = sanitizeJsonText(stripCodeFence(raw));
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return JSON.stringify(parsed);
  } catch {
    const block = extractJsonBlock(cleaned);
    if (!block) return raw;
    try {
      const parsed = JSON.parse(sanitizeJsonText(block)) as Record<string, unknown>;
      return JSON.stringify(parsed);
    } catch {
      return raw;
    }
  }
}

export async function generateSummaryFromInsights(insights: TaskInsights) {
  const dataPack = packInsightsForPrompt(insights);
  const userMessage = `${SUMMARY_USER_PROMPT}\n\nDATA PACK (JSON):\n${dataPack}`;
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS_SUMMARY || 900) || 900;

  const response = await runOpenAIChat({
    temperature: 0.2,
    maxTokens,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ]
  });

  return {
    ...response,
    content: normalizeSummaryJson(response.content)
  };
}
