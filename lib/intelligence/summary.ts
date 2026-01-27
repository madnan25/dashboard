import "server-only";

import { runOpenAIChat } from "@/lib/intelligence/openaiClient";
import { packInsightsForPrompt } from "@/lib/intelligence/taskInsights";
import type { TaskInsights } from "@/lib/intelligence/taskInsights";

const SUMMARY_SYSTEM_PROMPT = [
  "You are Intelligence Desk, an executive operations analyst for a marketing organization.",
  "Use only the provided data pack. If data is missing, say you do not have it.",
  "Use task description snippets and latest comment snippets for context.",
  "Pay special attention to dependency summaries and blocked chains.",
  "Be concise, high-signal, and avoid filler.",
  "Prioritize blockers, risks, and urgent priorities.",
  "Use short sections with bullet points."
].join(" ");

const SUMMARY_USER_PROMPT = [
  "Create a CMO summary report with these sections:",
  "1) Overview",
  "2) Blockers (what is blocked by what, based on descriptions/comments)",
  "3) Priorities (P0/P1 and overdue items)",
  "4) Team Highlights (who is overloaded or idle)",
  "5) Project Risks",
  "6) Next Actions (what to follow up on)"
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
