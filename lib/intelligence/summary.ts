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
  "- Focus on blockers, risks, and urgent priorities."
].join("\n");

export async function generateSummaryFromInsights(insights: TaskInsights) {
  const dataPack = packInsightsForPrompt(insights);
  const userMessage = `${SUMMARY_USER_PROMPT}\n\nDATA PACK (JSON):\n${dataPack}`;
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS_SUMMARY || 900) || 900;

  return await runOpenAIChat({
    temperature: 0.2,
    maxTokens,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ]
  });
}
