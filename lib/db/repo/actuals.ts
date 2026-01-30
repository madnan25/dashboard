import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DigitalSource,
  PlanChannel,
  ProjectActuals,
  ProjectActualsChannel,
  ProjectActualsDigitalSource,
  SalesOpsActualsAuditEntry
} from "@/lib/db/types";

export type ProjectActualsMetricsInput = Pick<
  ProjectActuals,
  // Channel totals are derived from project_actuals_channels; only keep the true totals here.
  "project_id" | "year" | "month" | "deals_won" | "sqft_won"
>;

export type ProjectActualsSpendInput = Pick<ProjectActuals, "project_id" | "year" | "month" | "spend_digital" | "spend_inbound" | "spend_activations">;

export type ProjectActualsChannelInput = Pick<
  ProjectActualsChannel,
  "project_id" |
    "year" |
    "month" |
    "channel" |
    "leads" |
    "not_contacted" |
    "qualified_leads" |
    "meetings_scheduled" |
    "meetings_done" |
    "deals_won" |
    "sqft_won"
>;

export type ProjectActualsDigitalSourceInput = Pick<
  ProjectActualsDigitalSource,
  "project_id" |
    "year" |
    "month" |
    "source" |
    "leads" |
    "not_contacted" |
    "qualified_leads" |
    "meetings_scheduled" |
    "meetings_done" |
    "deals_won" |
    "sqft_won"
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
      "project_id, year, month, leads, qualified_leads, meetings_scheduled, meetings_done, deals_won, sqft_won, deals_won_transfer_in, sqft_won_transfer_in, deals_won_transfer_out, sqft_won_transfer_out, deals_won_misc, sqft_won_misc, spend_digital, spend_inbound, spend_activations"
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
    .select("project_id, year, month, channel, leads, not_contacted, qualified_leads, meetings_scheduled, meetings_done, deals_won, sqft_won, updated_at")
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

export async function listProjectActualsDigitalSources(
  supabase: SupabaseClient,
  projectId: string,
  year: number,
  month: number
): Promise<ProjectActualsDigitalSource[]> {
  const { data, error } = await supabase
    .from("project_actuals_digital_sources")
    .select(
      "project_id, year, month, source, leads, not_contacted, qualified_leads, meetings_scheduled, meetings_done, deals_won, sqft_won, updated_at"
    )
    .eq("project_id", projectId)
    .eq("year", year)
    .eq("month", month);
  if (error) throw error;
  return (data as ProjectActualsDigitalSource[]) ?? [];
}

export async function upsertProjectActualsDigitalSources(supabase: SupabaseClient, inputs: ProjectActualsDigitalSourceInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const { error } = await supabase
    .from("project_actuals_digital_sources")
    .upsert(inputs, { onConflict: "project_id,year,month,source" });
  if (error) throw error;
}

export type ListSalesOpsActualsAuditFilters = {
  projectId?: string | null;
  year?: number | null;
  month?: number | null;
  limit?: number;
  sinceDays?: number;
};

const salesOpsAuditSelect =
  "id, event_time, action, table_name, project_id, year, month, channel, source, bucket, closed_project_id, source_project_id, actor_id, actor_role, actor_email, actor_name, old_row, new_row";

export async function listSalesOpsActualsAudit(
  supabase: SupabaseClient,
  filters?: ListSalesOpsActualsAuditFilters
): Promise<SalesOpsActualsAuditEntry[]> {
  const sinceDays = filters?.sinceDays ?? 7;
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  let q = supabase.from("sales_ops_actuals_audit").select(salesOpsAuditSelect).gte("event_time", sinceIso).order("event_time", {
    ascending: false
  });
  if (filters?.projectId) q = q.eq("project_id", filters.projectId);
  if (typeof filters?.year === "number") q = q.eq("year", filters.year);
  if (typeof filters?.month === "number") q = q.eq("month", filters.month);
  if (filters?.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data as SalesOpsActualsAuditEntry[]) ?? [];
}

