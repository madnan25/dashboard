import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(req: Request) {
  // Supabase Functions are called cross-origin from the Vercel app.
  // We must answer CORS preflights, otherwise the browser blocks the request.
  const origin = req.headers.get("origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-authorization, x-supabase-client, x-requested-with",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "origin"
  } as const;
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(req)
    }
  });
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function getUserIdFromBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1]!.trim();
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]!));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(req, 500, { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  const userId = getUserIdFromBearer(req);
  if (!userId) return json(req, 401, { ok: false, error: "Unauthorized" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { ok: false, error: "Invalid JSON body" });
  }

  const planVersionId = (body as { planVersionId?: unknown })?.planVersionId;
  if (typeof planVersionId !== "string" || planVersionId.length < 10) {
    return json(req, 400, { ok: false, error: "Missing planVersionId" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  // Authorize: only CMO can purge plan versions
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) return json(500, { ok: false, error: profileError.message });
  if (profileError) return json(req, 500, { ok: false, error: profileError.message });
  if (!profile || profile.role !== "cmo") return json(req, 403, { ok: false, error: "CMO only" });

  // Guard: only draft/rejected can be purged
  const { data: pv, error: pvErr } = await admin
    .from("project_plan_versions")
    .select("id,status,active")
    .eq("id", planVersionId)
    .maybeSingle();

  if (pvErr) return json(req, 500, { ok: false, error: pvErr.message });
  if (!pv) return json(req, 404, { ok: false, error: "Plan version not found" });
  if (pv.status !== "draft" && pv.status !== "rejected") {
    return json(req, 400, { ok: false, error: "Only draft/rejected plans can be deleted" });
  }
  if (pv.active) return json(req, 400, { ok: false, error: "Cannot delete an active plan" });

  // Purge: deleting the plan version cascades to channel inputs
  const { error: delErr } = await admin.from("project_plan_versions").delete().eq("id", planVersionId);
  if (delErr) return json(req, 500, { ok: false, error: delErr.message });

  return json(req, 200, { ok: true });
});
