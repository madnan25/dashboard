import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { buildTaskInsights, packInsightsForPrompt } from "@/lib/intelligence/taskInsights";
import { generateSummaryFromInsights } from "@/lib/intelligence/summary";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function getCronSecret(req: Request) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret") || "";
  const fromHeader = req.headers.get("x-cron-secret") || "";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return fromQuery || fromHeader || bearer;
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return json(500, { error: "Missing CRON_SECRET." });

  const provided = getCronSecret(req);
  if (!provided || provided !== expected) return json(401, { error: "Unauthorized." });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return json(500, { error: "Missing SUPABASE_SERVICE_ROLE_KEY." });
  }

  const { url } = getSupabaseEnv();
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const insights = await buildTaskInsights({ supabase });
    const dataPack = packInsightsForPrompt(insights);
    const summary = await generateSummaryFromInsights(insights);

    const { error } = await supabase.from("intelligence_reports").insert({
      report_type: "scheduled",
      summary: summary.content,
      range_start: insights.window.recent_cutoff,
      range_end: insights.window.today,
      model: summary.model,
      token_usage: summary.usage ?? null,
      insights_json: insights,
      data_pack: dataPack
    });
    if (error) throw error;

    return json(200, { ok: true, generated_at: insights.generated_at });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Failed to generate report." });
  }
}
