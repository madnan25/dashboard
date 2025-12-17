import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type"); // e.g. "magiclink" | "recovery" | "invite"
  const redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/";

  try {
    const supabase = await createClient();
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

  const url = requestUrl;
  url.pathname = redirectTo;
  url.search = "";
  return NextResponse.redirect(url);
}

