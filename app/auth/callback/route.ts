import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type"); // e.g. "magiclink" | "recovery" | "invite"
  const redirectToRaw = requestUrl.searchParams.get("redirectTo") ?? "/";
  const redirectTo = redirectToRaw.startsWith("/") ? redirectToRaw : "/";

  const redirectUrl = new URL(redirectTo, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);

  try {
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createServerClient(url, anonKey, {
      auth: { flowType: "pkce" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    });
    if (code) {
      // PKCE flow (most common for magic links)
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash && type) {
      // Token-hash flow (recovery/invite/magiclink depending on settings/templates)
      // @ts-expect-error - supabase types accept specific union; URL params are strings.
      await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    }
  } catch {
    // Swallow auth callback errors and continue redirecting to login/home.
  }

  return response;
}

