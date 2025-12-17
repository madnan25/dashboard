import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function userExistsByEmail(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("missing_url");
  if (!serviceRole) throw new Error("missing_service_role");

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  // Supabase admin API doesn't offer direct lookup by email, so we scan in pages.
  // This is fine for small org user counts. If you expect many users, we can
  // switch to an Edge Function + privileged query pattern.
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    if (users.some((u) => (u.email ?? "").toLowerCase() === email.toLowerCase())) return true;
    if (users.length < perPage) break;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json(500, { error: "missing_public_env" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "missing_service_role" });

  const body = (await request.json().catch(() => null)) as null | {
    email?: string;
    redirectTo?: string;
    origin?: string;
  };
  const email = (body?.email ?? "").trim();
  const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : "/";
  const origin = typeof body?.origin === "string" ? body.origin : null;

  if (!email || !isValidEmail(email)) return json(400, { error: "invalid_email" });
  if (!origin) return json(400, { error: "missing_origin" });

  // 1) Check existence first
  try {
    const exists = await userExistsByEmail(email);
    if (!exists) return json(404, { error: "user_not_found" });
  } catch (e) {
    // Avoid leaking details; use coarse error codes
    if (e instanceof Error && e.message === "missing_service_role") return json(500, { error: "missing_service_role" });
    if (e instanceof Error && e.message === "missing_url") return json(500, { error: "missing_public_env" });
    return json(500, { error: "admin_lookup_failed" });
  }

  // 2) Send magic link (still via anon client, so Supabase sends the email)
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const emailRedirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  if (error) return json(500, { error: "otp_send_failed" });

  return json(200, { ok: true });
}

