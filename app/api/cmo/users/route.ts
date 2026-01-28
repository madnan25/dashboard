import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function isRole(v: unknown): v is UserRole {
  return v === "cmo" || v === "brand_manager" || v === "member" || v === "sales_ops" || v === "viewer";
}

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return json(500, { error: "Server auth is not configured. Missing SUPABASE_SERVICE_ROLE_KEY." });
  }

  let supabaseUrl: string;
  try {
    // Normalize URL (allows bare ref or full URL).
    supabaseUrl = getSupabaseEnv().url;
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Missing Supabase env vars" });
  }

  // Authenticate requester via cookies (normal anon-key server client)
  const supabase = await createSupabaseServerClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return json(401, { error: "Not authenticated" });

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (profileErr) return json(500, { error: "Failed to verify role" });
  if (!profile || profile.role !== "cmo") return json(403, { error: "CMO only" });

  const body = (await req.json().catch(() => null)) as null | { email?: unknown; role?: unknown; full_name?: unknown };
  if (!body) return json(400, { error: "Invalid JSON body" });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role;
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : null;

  if (!email || !email.includes("@")) return json(400, { error: "Valid email is required" });
  if (!isRole(role)) return json(400, { error: "Valid role is required" });

  // Admin client (service role) to create auth user (no password needed)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: full_name ? { full_name } : undefined
  });

  if (error || !data.user) {
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("exists")) {
      return json(409, { error: "User already exists" });
    }
    return json(500, { error: error?.message || "Failed to create user" });
  }

  // Ensure profile role matches requested role
  const patch: { id: string; role: UserRole; email: string; full_name?: string | null } = {
    id: data.user.id,
    role,
    email,
    full_name: full_name || null
  };

  // Use upsert so we handle any timing issues where the profile row isn't created yet.
  const { error: upErr } = await admin.from("profiles").upsert(patch, { onConflict: "id" });
  if (upErr) return json(500, { error: `User created but failed to set role: ${upErr.message}` });

  return json(200, { userId: data.user.id });
}

export async function DELETE(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return json(500, { error: "Server auth is not configured. Missing SUPABASE_SERVICE_ROLE_KEY." });
  }

  let supabaseUrl: string;
  try {
    supabaseUrl = getSupabaseEnv().url;
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Missing Supabase env vars" });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return json(401, { error: "Not authenticated" });

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (profileErr) return json(500, { error: "Failed to verify role" });
  if (!profile || profile.role !== "cmo") return json(403, { error: "CMO only" });

  const body = (await req.json().catch(() => null)) as null | { userId?: unknown };
  if (!body) return json(400, { error: "Invalid JSON body" });
  const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!targetUserId) return json(400, { error: "User ID is required" });
  if (targetUserId === userRes.user.id) return json(400, { error: "You cannot delete your own account." });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const warnings: string[] = [];
  const recordError = (label: string, error: { message: string } | null) => {
    if (error) warnings.push(`${label}: ${error.message}`);
  };

  // Clear FK references that would block profile deletion.
  {
    const { error } = await admin.from("project_plan_versions").update({ approved_by: null }).eq("approved_by", targetUserId);
    recordError("Clear plan approvals", error);
  }
  {
    const { error } = await admin.from("tasks").update({ assignee_id: null }).eq("assignee_id", targetUserId);
    recordError("Unassign tickets", error);
  }
  {
    const { error } = await admin
      .from("project_plan_versions")
      .update({ created_by: userRes.user.id })
      .eq("created_by", targetUserId);
    recordError("Reassign plan versions", error);
  }
  {
    const { error } = await admin.from("project_targets").update({ created_by: null }).eq("created_by", targetUserId);
    recordError("Clear project targets", error);
  }
  {
    const { error } = await admin.from("project_actuals").update({ updated_by: null }).eq("updated_by", targetUserId);
    recordError("Clear project actuals", error);
  }
  {
    const { error } = await admin.from("project_actuals_channels").update({ updated_by: null }).eq("updated_by", targetUserId);
    recordError("Clear project actuals channels", error);
  }
  {
    const { error } = await admin.from("sales_attribution_events").update({ created_by: null }).eq("created_by", targetUserId);
    recordError("Clear sales attribution", error);
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (deleteErr) return json(500, { error: deleteErr.message, warnings: warnings.length > 0 ? warnings : undefined });

  return json(200, { ok: true, warnings: warnings.length > 0 ? warnings : undefined });
}


