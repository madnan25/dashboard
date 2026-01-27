import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

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

function normalizeTimeForInput(value: unknown) {
  if (typeof value !== "string") return "";
  const m = value.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

export async function GET() {
  const auth = await requireCmo();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase.rpc("get_intelligence_sync_settings");
  if (error) return json(500, { error: error.message || "Failed to load settings" });

  const row = Array.isArray(data) ? data[0] : data;
  return json(200, {
    timezone: row?.timezone ?? "Asia/Karachi",
    sync_time: normalizeTimeForInput(row?.sync_time),
    schedule_utc: row?.schedule_utc ?? null,
    jobname: row?.jobname ?? null,
    updated_at: row?.updated_at ?? null
  });
}

export async function POST(req: Request) {
  const auth = await requireCmo();
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as null | { sync_time?: unknown; timezone?: unknown };
  if (!body) return json(400, { error: "Invalid JSON body" });

  const syncTime = typeof body.sync_time === "string" ? body.sync_time.trim() : "";
  const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "Asia/Karachi";

  if (!/^\d{2}:\d{2}$/.test(syncTime)) return json(400, { error: "sync_time must be HH:MM" });

  // Pass "HH:MM:00" to Postgres TIME.
  const { data, error } = await auth.supabase.rpc("set_intelligence_sync_time", {
    p_sync_time: `${syncTime}:00`,
    p_timezone: timezone
  });
  if (error) return json(500, { error: error.message || "Failed to update schedule" });

  const row = Array.isArray(data) ? data[0] : data;
  return json(200, {
    ok: true,
    timezone: row?.timezone ?? timezone,
    sync_time: normalizeTimeForInput(row?.sync_time) || syncTime,
    schedule_utc: row?.schedule_utc ?? null,
    jobname: row?.jobname ?? null,
    updated_at: row?.updated_at ?? null
  });
}

