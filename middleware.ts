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

  return NextResponse.next({
    request: {
      headers: request.headers
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)"]
};

