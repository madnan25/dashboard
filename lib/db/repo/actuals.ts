import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectActuals } from "@/lib/db/types";

export async function getProjectActuals(
  supabase: SupabaseClient,
  projectId: string,
  year: number,
  month: number
): Promise<ProjectActuals | null> {
  const { data, error } = await supabase
    .from("project_actuals")
    .select(
      "project_id, year, month, leads, qualified_leads, meetings_scheduled, meetings_done, deals_won, sqft_won, spend_digital, spend_inbound, spend_activations"
    )
    .eq("project_id", projectId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectActuals | null) ?? null;
}

export async function upsertProjectActuals(supabase: SupabaseClient, input: ProjectActuals): Promise<void> {
  const { error } = await supabase.from("project_actuals").upsert(input, { onConflict: "project_id,year,month" });
  if (error) throw error;
}

