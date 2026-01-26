import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { buildTaskInsights, packInsightsForPrompt } from "@/lib/intelligence/taskInsights";
import { runOpenAIChat } from "@/lib/intelligence/openaiClient";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

async function requireCmo() {
  const supabase = await createSupabaseServerClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return { error: json(401, { error: "Not authenticated" }) };

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (profileErr) return { error: json(500, { error: "Failed to verify role" }) };
  if (!profile || profile.role !== "cmo") return { error: json(403, { error: "CMO only" }) };

  return { supabase };
}

const CHAT_SYSTEM_PROMPT = [
  "You are Intelligence Desk, an executive operations assistant.",
  "Answer questions using only the provided data pack.",
  "If data is not available, say you do not have it.",
  "Be concise and actionable."
].join(" ");

export async function POST(req: Request) {
  const auth = await requireCmo();
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as
    | null
    | {
        question?: unknown;
        history?: Array<{ role?: unknown; content?: unknown }>;
      };
  if (!body) return json(400, { error: "Invalid JSON body" });

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return json(400, { error: "Question is required" });

  const history = Array.isArray(body.history) ? body.history : [];
  const sanitizedHistory = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).trim() }))
    .filter((m) => m.content.length > 0)
    .slice(-10);

  const insights = await buildTaskInsights();
  const dataPack = packInsightsForPrompt(insights);

  const messages = [
    { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
    { role: "user" as const, content: `DATA PACK (JSON):\n${dataPack}` },
    ...sanitizedHistory,
    { role: "user" as const, content: question }
  ];

  try {
    const reply = await runOpenAIChat({ messages, temperature: 0.2, maxTokens: 700 });
    return json(200, {
      reply: reply.content,
      generated_at: new Date().toISOString(),
      model: reply.model
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Failed to answer question" });
  }
}
