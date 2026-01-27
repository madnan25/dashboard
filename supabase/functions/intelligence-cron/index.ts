import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

Deno.serve(async (req) => {
  const targetUrl = Deno.env.get("INTELLIGENCE_CRON_URL");
  const secret = Deno.env.get("CRON_SECRET");

  if (!targetUrl) return json(500, { ok: false, error: "Missing INTELLIGENCE_CRON_URL" });
  if (!secret) return json(500, { ok: false, error: "Missing CRON_SECRET" });

  const provided = req.headers.get("x-cron-secret") || "";
  if (!provided || provided !== secret) return json(401, { ok: false, error: "Unauthorized" });

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "x-cron-secret": secret
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json(500, { ok: false, error: `Cron target failed (${res.status})`, detail: text.slice(0, 400) });
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : "Failed to call cron target" });
  }
});
