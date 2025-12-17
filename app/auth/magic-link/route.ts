import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json(500, { error: "missing_public_env" });

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

  // Send magic link but DO NOT create new users.
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const emailRedirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false }
  });
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("user not found") || msg.includes("signup") || msg.includes("sign up") || msg.includes("not allowed")) {
      return json(404, { error: "user_not_found" });
    }
    return json(500, { error: "otp_send_failed" });
  }

  return json(200, { ok: true });
}

