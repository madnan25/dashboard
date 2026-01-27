import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { buildTaskInsights, packInsightsForPrompt } from "@/lib/intelligence/taskInsights";
import { generateSummaryFromInsights } from "@/lib/intelligence/summary";

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

export async function GET(req: Request) {
  const auth = await requireCmo();
  if ("error" in auth) return auth.error;
  const supabase = auth.supabase;

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

  const { data: latestReport, error: reportErr } = await supabase
    .from("intelligence_reports")
    .select("id, summary, created_at, report_type, range_start, range_end, model, insights_json")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportErr) return json(500, { error: "Failed to load cached summary" });

  if (!force && latestReport) {
    return json(200, {
      cached: true,
      summary: latestReport.summary,
      generated_at: latestReport.created_at,
      report: latestReport,
      insights: latestReport.insights_json ?? null
    });
  }

  if (!force && !latestReport) {
    return json(404, { error: "No cached summary yet. Run refresh or wait for the scheduled sync." });
  }

  try {
    const insights = await buildTaskInsights();
    const dataPack = packInsightsForPrompt(insights);
    const summary = await generateSummaryFromInsights(insights);

    const insert = await supabase.from("intelligence_reports").insert({
      report_type: "manual",
      summary: summary.content,
      range_start: insights.window.recent_cutoff,
      range_end: insights.window.today,
      model: summary.model,
      token_usage: summary.usage ?? null,
      insights_json: insights,
      data_pack: dataPack
    });
    if (insert.error) throw insert.error;

    return json(200, {
      cached: false,
      summary: summary.content,
      generated_at: insights.generated_at,
      report: {
        report_type: "manual",
        created_at: insights.generated_at,
        range_start: insights.window.recent_cutoff,
        range_end: insights.window.today,
        model: summary.model
      },
      insights
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Failed to generate summary" });
  }
}
