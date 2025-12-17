import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set<string>(["/login", "/auth/callback", "/auth/magic-link", "/logout"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return atob(padded);
}

function isJwtNotExpired(jwt: string) {
  const parts = jwt.split(".");
  if (parts.length < 2) return false;
  try {
    const payloadRaw = base64UrlDecode(parts[1]!);
    const payload = JSON.parse(payloadRaw) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    // small skew to avoid edge-of-expiry weirdness
    return Date.now() / 1000 < payload.exp - 10;
  } catch {
    return false;
  }
}

function extractAccessTokenFromCookies(request: NextRequest): string | null {
  // Legacy cookie names
  const legacy = request.cookies.get("sb-access-token")?.value;
  if (legacy) return legacy;

  // Supabase SSR cookie: sb-<project-ref>-auth-token (JSON containing access_token)
  for (const c of request.cookies.getAll()) {
    if (!(c.name.startsWith("sb-") && c.name.endsWith("-auth-token"))) continue;
    const raw = c.value;
    try {
      const decoded = decodeURIComponent(raw);
      const parsed = JSON.parse(decoded) as { access_token?: string };
      if (typeof parsed.access_token === "string" && parsed.access_token.length > 0) return parsed.access_token;
    } catch {
      // ignore
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow the app to run locally even before env vars are configured.
  // Once env vars are set (Vercel/local), auth+RLS becomes enforced.
  if (!url || !anonKey) return NextResponse.next();

  const requestUrl = request.nextUrl;
  const accessToken = extractAccessTokenFromCookies(request);
  const isAuthed = accessToken ? isJwtNotExpired(accessToken) : false;

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

