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
    const loginUrl = requestUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", requestUrl.pathname + requestUrl.search);
    return NextResponse.redirect(loginUrl);
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
        const ok =
          role === "cmo" ||
          role === "admin_viewer" ||
          (role !== "sales_ops" && (role === "brand_manager" || role === "member" || p?.is_marketing_team === true));

        if (!ok) {
          const nextUrl = requestUrl.clone();
          nextUrl.pathname = "/";
          nextUrl.search = "";
          return NextResponse.redirect(nextUrl);
        }
      } else {
        // If profile fetch fails, fall back to safe behavior: block tasks.
        const nextUrl = requestUrl.clone();
        nextUrl.pathname = "/";
        nextUrl.search = "";
        return NextResponse.redirect(nextUrl);
      }
    } catch {
      const nextUrl = requestUrl.clone();
      nextUrl.pathname = "/";
      nextUrl.search = "";
      return NextResponse.redirect(nextUrl);
    }
  }

  return NextResponse.next({
    request: {
      headers: request.headers
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)"]
};

