import { NextRequest, NextResponse } from "next/server";
import { extractAccessTokenFromCookieEntries, isJwtNotExpired } from "@/lib/auth/supabaseCookies";

const PUBLIC_PATHS = new Set<string>(["/login", "/auth/callback", "/logout"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function extractAccessTokenFromCookies(request: NextRequest): string | null {
  return extractAccessTokenFromCookieEntries(request.cookies.getAll());
}

function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const json = atob(b64);
    const data = JSON.parse(json) as { sub?: string };
    return typeof data.sub === "string" ? data.sub : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const canonical = process.env.NEXT_PUBLIC_SITE_URL;

  // Allow the app to run locally even before env vars are configured.
  // Once env vars are set (Vercel/local), auth+RLS becomes enforced.
  if (!url || !anonKey) return NextResponse.next();

  const requestUrl = request.nextUrl;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/1b91cf07-cede-4e5e-bddb-5ac83c7a36c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'nav-block',hypothesisId:'H1',location:'middleware.ts:42',message:'middleware_enter',data:{pathname:requestUrl.pathname,search:requestUrl.search,hasEnv:Boolean(url&&anonKey),isPublic:isPublicPath(requestUrl.pathname)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

  // Canonical host: if user is on the Vercel domain, redirect to custom domain.
  // This helps keep magic-link redirects + cookies consistent.
  if (canonical) {
    try {
      const canonicalUrl = new URL(canonical);
      const reqHost = request.headers.get("host") ?? "";
      if (reqHost.endsWith("vercel.app") && canonicalUrl.host && canonicalUrl.host !== reqHost) {
        const redirect = requestUrl.clone();
        redirect.protocol = canonicalUrl.protocol;
        redirect.host = canonicalUrl.host;
        return NextResponse.redirect(redirect);
      }
    } catch {
      // ignore invalid canonical URL
    }
  }

  const accessToken = extractAccessTokenFromCookies(request);
  const isAuthed = accessToken ? isJwtNotExpired(accessToken) : false;

  // If already authed, never show /login again.
  if (isAuthed && requestUrl.pathname === "/login") {
    const redirectToRaw = requestUrl.searchParams.get("redirectTo") ?? "/";
    const redirectTo = redirectToRaw.startsWith("/") && redirectToRaw !== "/login" ? redirectToRaw : "/";
    const nextUrl = requestUrl.clone();
    nextUrl.pathname = redirectTo;
    nextUrl.search = "";
    return NextResponse.redirect(nextUrl);
  }

  if (!isAuthed && !isPublicPath(requestUrl.pathname)) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1b91cf07-cede-4e5e-bddb-5ac83c7a36c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'nav-block',hypothesisId:'H1',location:'middleware.ts:72',message:'redirect_to_login',data:{pathname:requestUrl.pathname},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    const loginUrl = requestUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", requestUrl.pathname + requestUrl.search);
    const resp = NextResponse.redirect(loginUrl);
    resp.headers.set("x-debug-mw", "redirect_to_login");
    resp.headers.set("x-debug-path", requestUrl.pathname);
    return resp;
  }

  // Tasks is marketing-team only (CMO is always allowed).
  if (isAuthed && (requestUrl.pathname === "/tasks" || requestUrl.pathname.startsWith("/tasks/"))) {
    const userId = accessToken ? decodeJwtSub(accessToken) : null;
    if (!userId) {
      const nextUrl = requestUrl.clone();
      nextUrl.pathname = "/";
      nextUrl.search = "";
      return NextResponse.redirect(nextUrl);
    }

    try {
      const res = await fetch(
        `${url}/rest/v1/profiles?select=role,is_marketing_team&id=eq.${encodeURIComponent(userId)}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (res.ok) {
        const rows = (await res.json()) as Array<{ role?: string; is_marketing_team?: boolean }>;
        const p = rows[0] ?? null;
        const role = p?.role ?? null;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1b91cf07-cede-4e5e-bddb-5ac83c7a36c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'nav-block',hypothesisId:'H3',location:'middleware.ts:104',message:'tasks_gate_profile',data:{role, is_marketing_team:Boolean(p?.is_marketing_team===true), resOk:true},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        const ok =
          role === "cmo" ||
          role === "admin_viewer" ||
          (role !== "sales_ops" && (role === "brand_manager" || role === "member" || p?.is_marketing_team === true));

        if (!ok) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1b91cf07-cede-4e5e-bddb-5ac83c7a36c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'nav-block',hypothesisId:'H3',location:'middleware.ts:109',message:'tasks_gate_blocked',data:{role},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          const nextUrl = requestUrl.clone();
          nextUrl.pathname = "/";
          nextUrl.search = "";
          const resp = NextResponse.redirect(nextUrl);
          resp.headers.set("x-debug-mw", "tasks_blocked_role");
          resp.headers.set("x-debug-path", requestUrl.pathname);
          resp.headers.set("x-debug-role", role || "null");
          return resp;
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1b91cf07-cede-4e5e-bddb-5ac83c7a36c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'nav-block',hypothesisId:'H2',location:'middleware.ts:115',message:'tasks_gate_profile_fetch_failed',data:{status:res.status},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        // If profile fetch fails, fall back to safe behavior: block tasks.
        const nextUrl = requestUrl.clone();
        nextUrl.pathname = "/";
        nextUrl.search = "";
        const resp = NextResponse.redirect(nextUrl);
        resp.headers.set("x-debug-mw", "tasks_blocked_profile_fetch_failed");
        resp.headers.set("x-debug-path", requestUrl.pathname);
        resp.headers.set("x-debug-status", String(res.status));
        return resp;
      }
    } catch {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1b91cf07-cede-4e5e-bddb-5ac83c7a36c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'nav-block',hypothesisId:'H2',location:'middleware.ts:122',message:'tasks_gate_exception',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      const nextUrl = requestUrl.clone();
      nextUrl.pathname = "/";
      nextUrl.search = "";
      const resp = NextResponse.redirect(nextUrl);
      resp.headers.set("x-debug-mw", "tasks_blocked_exception");
      resp.headers.set("x-debug-path", requestUrl.pathname);
      return resp;
    }
  }

  const resp = NextResponse.next({
    request: {
      headers: request.headers
    }
  });
  resp.headers.set("x-debug-mw", "next");
  resp.headers.set("x-debug-path", requestUrl.pathname);
  resp.headers.set("x-debug-authed", isAuthed ? "1" : "0");
  return resp;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)"]
};

