import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set<string>(["/login", "/auth/callback", "/logout"]);

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

function decodeSupabaseCookieValue(raw: string): string {
  // @supabase/ssr uses "base64url" cookieEncoding by default and prefixes values with "base64-".
  // See node_modules/@supabase/ssr/src/cookies.ts
  const BASE64_PREFIX = "base64-";
  if (raw.startsWith(BASE64_PREFIX)) {
    return base64UrlDecode(raw.slice(BASE64_PREFIX.length));
  }
  return raw;
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

function tryParseSupabaseAuthCookie(raw: string): { access_token?: string } | null {
  const candidates: string[] = [];
  // raw / decoded / base64-decoded variants
  candidates.push(raw, decodeSupabaseCookieValue(raw));
  try {
    const dec = decodeURIComponent(raw);
    candidates.push(dec, decodeSupabaseCookieValue(dec));
  } catch {
    // ignore
  }

  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand) as { access_token?: string };
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

function extractAccessTokenFromCookies(request: NextRequest): string | null {
  // Legacy cookie names
  const legacy = request.cookies.get("sb-access-token")?.value;
  if (legacy) return legacy;

  // Supabase SSR cookie can be either:
  // - sb-<project-ref>-auth-token
  // - sb-<project-ref>-auth-token.0 / .1 / ... (chunked)
  const cookies = request.cookies.getAll();
  const direct = cookies.find((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
  if (direct) {
    const parsed = tryParseSupabaseAuthCookie(direct.value);
    if (typeof parsed?.access_token === "string" && parsed.access_token.length > 0) return parsed.access_token;
  }

  // Chunked: group by base name without .<index>
  const chunkMap = new Map<string, Array<{ idx: number; value: string }>>();
  for (const c of cookies) {
    if (!c.name.startsWith("sb-")) continue;
    const m = c.name.match(/^(sb-.*-auth-token)\.(\d+)$/);
    if (!m) continue;
    const base = m[1]!;
    const idx = Number(m[2]!);
    const arr = chunkMap.get(base) ?? [];
    arr.push({ idx, value: c.value });
    chunkMap.set(base, arr);
  }

  for (const [, chunks] of chunkMap) {
    chunks.sort((a, b) => a.idx - b.idx);
    const joined = chunks.map((c) => c.value).join("");
    const parsed = tryParseSupabaseAuthCookie(joined);
    if (typeof parsed?.access_token === "string" && parsed.access_token.length > 0) return parsed.access_token;
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

