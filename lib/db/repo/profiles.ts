import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/db/types";

async function requireUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("Not authenticated");
  return data.user.id;
}

export async function getCurrentProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const userId = await requireUserId(supabase).catch(() => null);
  if (!userId) return null;

  const { data, error } = await supabase.from("profiles").select("id, role, full_name").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateMyFullName(supabase: SupabaseClient, full_name: string): Promise<void> {
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("profiles").update({ full_name }).eq("id", userId);
  if (error) throw error;
}

