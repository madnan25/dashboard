import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/db/types";

async function requireUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("Not authenticated");
  return data.user.id;
}

export async function getCurrentProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const userId = await requireUserId(supabase).catch(() => null);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_marketing_team, marketing_team_role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateMyFullName(supabase: SupabaseClient, full_name: string): Promise<void> {
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("profiles").update({ full_name }).eq("id", userId);
  if (error) throw error;
}

export async function listProfiles(supabase: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_marketing_team, marketing_team_role")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Profile[]) ?? [];
}

export async function updateUserRole(supabase: SupabaseClient, userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

export async function listProfilesByIds(supabase: SupabaseClient, ids: string[]): Promise<Profile[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_marketing_team, marketing_team_role")
    .in("id", unique);
  if (error) throw error;
  return (data as Profile[]) ?? [];
}

export async function updateUserIsMarketingTeam(supabase: SupabaseClient, userId: string, isMarketing: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_marketing_team: isMarketing }).eq("id", userId);
  if (error) throw error;
}

export async function updateUserMarketingTeamRole(
  supabase: SupabaseClient,
  userId: string,
  role: "member" | "manager"
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ marketing_team_role: role }).eq("id", userId);
  if (error) throw error;
}

