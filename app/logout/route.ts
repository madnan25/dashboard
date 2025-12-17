import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // If Supabase env vars aren't configured, still clear cookies and redirect.
  }

  // Ensure we clear any Supabase session cookies (naming varies by helper version).
  const store = await cookies();
  for (const c of store.getAll()) {
    if (c.name === "sb-access-token" || c.name === "sb-refresh-token" || (c.name.startsWith("sb-") && c.name.endsWith("-auth-token"))) {
      store.delete(c.name);
    }
  }

  const url = new URL(request.url);
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

