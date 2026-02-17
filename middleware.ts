import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = new Set<string>(["/login", "/auth/callback", "/logout"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const canonical = process.env.NEXT_PUBLIC_SITE_URL;

  // Allow the app to run locally even before env vars are configured.
  // Once env vars are set (Vercel/local), auth+RLS becomes enforced.
  let env: { url: string; anonKey: string } | null = null;
  try {
    env = getSupabaseEnv();
  } catch {
    env = null;
  }
  if (!env) return NextResponse.next();

  const requestUrl = request.nextUrl;

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

  // Use Supabase SSR in middleware so sessions can be refreshed (via refresh token)
  // instead of treating users as logged-out when the access token expires.
  const cookiesToSet: Array<{ name: string; value: string; options?: any }> = [];
  const supabase = createServerClient(env.url, env.anonKey, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(next) {
        cookiesToSet.push(...next);
      }
    }
  });

  const userRes = await supabase.auth.getUser().catch(() => null);
  const user = userRes?.data?.user ?? null;
  const isAuthed = Boolean(user);

  // Avoid breaking App Router navigation: RSC requests should not be redirected.
  // These requests are used to fetch server components during client navigation.
  const isRscRequest =
    request.headers.get("RSC") === "1" || request.headers.has("next-router-state-tree");
  if (isRscRequest) {
    const resp = NextResponse.next();
    for (const c of cookiesToSet) resp.cookies.set(c.name, c.value, c.options);
    return resp;
  }

  // If already authed, never show /login again.
  if (isAuthed && requestUrl.pathname === "/login") {
    const redirectToRaw = requestUrl.searchParams.get("redirectTo") ?? "/";
    const redirectTo = redirectToRaw.startsWith("/") && redirectToRaw !== "/login" ? redirectToRaw : "/";
    const nextUrl = requestUrl.clone();
    nextUrl.pathname = redirectTo;
    nextUrl.search = "";
    const resp = NextResponse.redirect(nextUrl);
    for (const c of cookiesToSet) resp.cookies.set(c.name, c.value, c.options);
    return resp;
  }

  if (!isAuthed && !isPublicPath(requestUrl.pathname)) {
    const loginUrl = requestUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", requestUrl.pathname + requestUrl.search);
    const resp = NextResponse.redirect(loginUrl);
    for (const c of cookiesToSet) resp.cookies.set(c.name, c.value, c.options);
    return resp;
  }

  // Tasks is marketing-team only (CMO is always allowed).
  if (isAuthed && (requestUrl.pathname === "/tasks" || requestUrl.pathname.startsWith("/tasks/"))) {
    const userId = user?.id ?? null;
    if (!userId) {
      const nextUrl = requestUrl.clone();
      nextUrl.pathname = "/";
      nextUrl.search = "";
      const resp = NextResponse.redirect(nextUrl);
      for (const c of cookiesToSet) resp.cookies.set(c.name, c.value, c.options);
      return resp;
    }

    try {
      const profRes = await supabase
        .from("profiles")
        .select("role,is_marketing_team")
        .eq("id", userId)
        .maybeSingle();

      const p = profRes.data ?? null;
      const role = (p as any)?.role ?? null;
      const isMarketing = Boolean((p as any)?.is_marketing_team === true);

      const ok =
        role === "cmo" ||
        role === "admin_viewer" ||
        (role !== "sales_ops" && (role === "brand_manager" || role === "member" || isMarketing));

      if (!ok) {
        const nextUrl = requestUrl.clone();
        nextUrl.pathname = "/";
        nextUrl.search = "";
        const resp = NextResponse.redirect(nextUrl);
        for (const c of cookiesToSet) resp.cookies.set(c.name, c.value, c.options);
        return resp;
      }
    } catch {
      const nextUrl = requestUrl.clone();
      nextUrl.pathname = "/";
      nextUrl.search = "";
      const resp = NextResponse.redirect(nextUrl);
      for (const c of cookiesToSet) resp.cookies.set(c.name, c.value, c.options);
      return resp;
    }
  }

  const resp = NextResponse.next();
  for (const c of cookiesToSet) resp.cookies.set(c.name, c.value, c.options);
  return resp;
}

export const config = {
  runtime: "nodejs",
  matcher: [
    {
      source: "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)",
      // Avoid breaking App Router navigation: prefetch/RSC requests can be redirected by middleware
      // and cause clicks to appear as "nothing happens".
      // Skip middleware for prefetch requests (they include these headers).
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};

