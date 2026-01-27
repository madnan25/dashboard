import "server-only";

import { runOpenAIChat } from "@/lib/intelligence/openaiClient";
import { packInsightsForPrompt } from "@/lib/intelligence/taskInsights";
import type { TaskInsights } from "@/lib/intelligence/taskInsights";

const SUMMARY_SYSTEM_PROMPT = [
  "You are Intelligence Desk, an executive operations analyst providing visibility to the CMO and CEO's office on marketing department activities.",
  "Use only the provided data pack. If data is missing, state that it’s unavailable.",
  "Leverage task descriptions and comment snippets for context, with special attention to dependency summaries and blocked chains.",
  "Be concise, high-signal, and avoid filler.",
  "Prioritize blockers, risks, and urgent priorities.",
  "Use blocker_ranked signals to infer genuine blockers; deprioritize low-severity dependency-only items.",
  "Use assignee_pressure and comment_signals to surface overload or urgent context.",
  "Use short sections with bullet points to ensure clarity and actionable insights."
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
  '  "next_actions": string[] (max 3, action verbs),',
  '  "what_im_noticing": string[] (max 3, natural and personal tone)'
  "}",
  "Rules:",
  "- If data is missing, use 'unknown'.",
  "- Keep items short and skimmable.",
  "- Focus on blockers, risks, and urgent priorities.",
  "- Use blocker_ranked (pre-scored) to decide genuine blockers. Prefer critical/high severity; omit low-severity blockers unless nothing else exists.",
  "- Order each list by severity/urgency with the worst items first.",
  "- Use what_im_noticing for overload/throughput risks or comment urgency (natural tone).",
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
