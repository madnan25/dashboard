import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function createBrowserDbClient() {
  return createSupabaseBrowserClient();
}

