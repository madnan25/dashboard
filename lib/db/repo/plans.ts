import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanChannelInputs, PlanStatus, PlanVersion } from "@/lib/db/types";

async function requireUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("Not authenticated");
  return data.user.id;
}

const PLAN_VERSION_SELECT =
  "id, project_id, year, month, created_by, status, active, approved_by, approved_at, rejected_at, created_at, updated_at";

export async function listPlanVersions(
  supabase: SupabaseClient,
  projectId: string,
  year: number,
  month: number
): Promise<PlanVersion[]> {
  const { data, error } = await supabase
    .from("project_plan_versions")
    .select(PLAN_VERSION_SELECT)
    .eq("project_id", projectId)
    .eq("year", year)
    .eq("month", month)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PlanVersion[]) ?? [];
}

export async function createDraftPlanVersion(
  supabase: SupabaseClient,
  projectId: string,
  year: number,
  month: number
): Promise<PlanVersion> {
  const userId = await requireUserId(supabase);

  const { data, error } = await supabase
    .from("project_plan_versions")
    .insert({
      project_id: projectId,
      year,
      month,
      created_by: userId,
      status: "draft",
      active: false
    })
    .select(PLAN_VERSION_SELECT)
    .single();
  if (error) throw error;
  return data as PlanVersion;
}

export async function updatePlanVersionStatus(supabase: SupabaseClient, planVersionId: string, status: PlanStatus): Promise<void> {
  const { error } = await supabase.from("project_plan_versions").update({ status }).eq("id", planVersionId);
  if (error) throw error;
}

export async function approvePlanVersion(supabase: SupabaseClient, planVersionId: string): Promise<void> {
  const userId = await requireUserId(supabase);

  const { error } = await supabase
    .from("project_plan_versions")
    .update({
      status: "approved",
      approved_by: userId,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      active: true
    })
    .eq("id", planVersionId);
  if (error) throw error;
}

export async function rejectPlanVersion(supabase: SupabaseClient, planVersionId: string): Promise<void> {
  const userId = await requireUserId(supabase);

  const { error } = await supabase
    .from("project_plan_versions")
    .update({
      status: "rejected",
      approved_by: userId,
      approved_at: null,
      rejected_at: new Date().toISOString(),
      active: false
    })
    .eq("id", planVersionId);
  if (error) throw error;
}

export async function deletePlanVersion(supabase: SupabaseClient, planVersionId: string): Promise<void> {
  const { error } = await supabase.from("project_plan_versions").delete().eq("id", planVersionId);
  if (error) throw error;
}

export async function getPlanChannelInputs(supabase: SupabaseClient, planVersionId: string): Promise<PlanChannelInputs[]> {
  const { data, error } = await supabase
    .from("project_plan_channel_inputs")
    .select("plan_version_id, channel, expected_leads, qualification_percent, target_contribution_percent, allocated_budget")
    .eq("plan_version_id", planVersionId);
  if (error) throw error;
  return (data as PlanChannelInputs[]) ?? [];
}

export async function upsertPlanChannelInputs(supabase: SupabaseClient, input: PlanChannelInputs): Promise<void> {
  const { error } = await supabase.from("project_plan_channel_inputs").upsert(input, { onConflict: "plan_version_id,channel" });
  if (error) throw error;
}

