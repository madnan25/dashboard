import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanChannel, ProjectActuals, ProjectActualsChannel } from "@/lib/db/types";

export type ProjectActualsMetricsInput = Pick<
  ProjectActuals,
  // Channel totals are derived from project_actuals_channels; only keep the true totals here.
  "project_id" | "year" | "month" | "deals_won" | "sqft_won"
>;

export type ProjectActualsSpendInput = Pick<ProjectActuals, "project_id" | "year" | "month" | "spend_digital" | "spend_inbound" | "spend_activations">;

export type ProjectActualsChannelInput = Pick<
  ProjectActualsChannel,
  "project_id" | "year" | "month" | "channel" | "leads" | "qualified_leads" | "meetings_scheduled" | "meetings_done" | "deals_won" | "sqft_won"
>;

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

// Partial upserts to avoid one role overwriting another role's fields.
export async function upsertProjectActualsMetrics(supabase: SupabaseClient, input: ProjectActualsMetricsInput): Promise<void> {
  const { error } = await supabase.from("project_actuals").upsert(input, { onConflict: "project_id,year,month" });
  if (error) throw error;
}

export async function upsertProjectActualsSpend(supabase: SupabaseClient, input: ProjectActualsSpendInput): Promise<void> {
  const { error } = await supabase.from("project_actuals").upsert(input, { onConflict: "project_id,year,month" });
  if (error) throw error;
}

export async function listProjectActualsChannels(
  supabase: SupabaseClient,
  projectId: string,
  year: number,
  month: number
): Promise<ProjectActualsChannel[]> {
  const { data, error } = await supabase
    .from("project_actuals_channels")
    .select("project_id, year, month, channel, leads, qualified_leads, meetings_scheduled, meetings_done, deals_won, sqft_won, updated_at")
    .eq("project_id", projectId)
    .eq("year", year)
    .eq("month", month);
  if (error) throw error;
  return (data as ProjectActualsChannel[]) ?? [];
}

export async function upsertProjectActualsChannels(supabase: SupabaseClient, inputs: ProjectActualsChannelInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const { error } = await supabase.from("project_actuals_channels").upsert(inputs, { onConflict: "project_id,year,month,channel" });
  if (error) throw error;
}

