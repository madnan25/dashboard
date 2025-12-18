import "server-only";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function createServerDbClient() {
  return await createSupabaseServerClient();
}

