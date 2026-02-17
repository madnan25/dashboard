"use client";

import { useEffect, useMemo } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthBootstrapper() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    // Hydrate session and ensure auto-refresh runs even for non-marketing users
    // (who may otherwise have no background Supabase activity).
    supabase.auth.getSession().catch(() => null);

    // supabase-js v2 exposes these; keep defensive to avoid runtime mismatch.
    (supabase.auth as any).startAutoRefresh?.();
    return () => {
      (supabase.auth as any).stopAutoRefresh?.();
    };
  }, [supabase]);

  return null;
}

