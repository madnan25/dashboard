import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectTargets } from "@/lib/db/types";

export async function getProjectTargets(
  supabase: SupabaseClient,
  projectId: string,
  year: number,
  month: number
): Promise<ProjectTargets | null> {
  const { data, error } = await supabase
    .from("project_targets")
    .select("project_id, year, month, sales_target_sqft, avg_sqft_per_deal, total_budget")
    .eq("project_id", projectId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectTargets | null) ?? null;
}

export async function upsertProjectTargets(supabase: SupabaseClient, input: ProjectTargets): Promise<void> {
  const { error } = await supabase.from("project_targets").upsert(input, { onConflict: "project_id,year,month" });
  if (error) throw error;
}

