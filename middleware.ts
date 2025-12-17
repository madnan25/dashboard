import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set<string>(["/login", "/auth/callback"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow the app to run locally even before env vars are configured.
  // Once env vars are set (Vercel/local), auth+RLS becomes enforced.
  if (!url || !anonKey) return NextResponse.next();

  const requestUrl = request.nextUrl;
  const accessToken = request.cookies.get("sb-access-token")?.value;
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;
  const isAuthed = Boolean(accessToken || refreshToken);

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

