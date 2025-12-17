import { createClient } from "@/lib/supabase/browser";

export type UserRole = "cmo" | "brand_manager" | "sales_ops";
export type PlanStatus = "draft" | "submitted" | "approved" | "rejected";
export type PlanChannel = "digital" | "activations" | "inbound";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
};

export type Project = {
  id: string;
  name: string;
  is_active: boolean;
};

export type ProjectTargets = {
  project_id: string;
  year: number;
  month: number; // 1-12
  sales_target_sqft: number;
  avg_sqft_per_deal: number;
  total_budget: number;
};

export type PlanVersion = {
  id: string;
  project_id: string;
  year: number;
  month: number; // 1-12
  created_by: string;
  status: PlanStatus;
  active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanChannelInputs = {
  plan_version_id: string;
  channel: PlanChannel;
  expected_leads: number;
  qualification_percent: number;
  target_contribution_percent: number;
  allocated_budget: number;
};

export type ProjectActuals = {
  project_id: string;
  year: number;
  month: number; // 1-12
  leads: number;
  qualified_leads: number;
  meetings_scheduled: number;
  meetings_done: number;
};

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function listProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select("id, name, is_active").order("name");
  if (error) throw error;
  return (data as Project[]) ?? [];
}

export async function createProject(name: string): Promise<Project> {
  const supabase = createClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name is required.");

  const { data, error } = await supabase
    .from("projects")
    .insert({ name: trimmed, is_active: true })
    .select("id, name, is_active")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(projectId: string, patch: Partial<Pick<Project, "name" | "is_active">>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) throw error;
}

export async function getProjectTargets(projectId: string, year: number, month: number): Promise<ProjectTargets | null> {
  const supabase = createClient();
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

export async function upsertProjectTargets(input: ProjectTargets): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_targets").upsert(input, { onConflict: "project_id,year,month" });
  if (error) throw error;
}

export async function listPlanVersions(projectId: string, year: number, month: number): Promise<PlanVersion[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_plan_versions")
    .select(
      "id, project_id, year, month, created_by, status, active, approved_by, approved_at, rejected_at, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("year", year)
    .eq("month", month)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PlanVersion[]) ?? [];
}

export async function createDraftPlanVersion(projectId: string, year: number, month: number): Promise<PlanVersion> {
  const supabase = createClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw userErr ?? new Error("Not authenticated");

  const { data, error } = await supabase
    .from("project_plan_versions")
    .insert({
      project_id: projectId,
      year,
      month,
      created_by: userRes.user.id,
      status: "draft",
      active: false
    })
    .select(
      "id, project_id, year, month, created_by, status, active, approved_by, approved_at, rejected_at, created_at, updated_at"
    )
    .single();
  if (error) throw error;
  return data as PlanVersion;
}

export async function updatePlanVersionStatus(planVersionId: string, status: PlanStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_plan_versions").update({ status }).eq("id", planVersionId);
  if (error) throw error;
}

export async function approvePlanVersion(planVersionId: string): Promise<void> {
  const supabase = createClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw userErr ?? new Error("Not authenticated");

  const { error } = await supabase
    .from("project_plan_versions")
    .update({
      status: "approved",
      approved_by: userRes.user.id,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      active: true
    })
    .eq("id", planVersionId);
  if (error) throw error;
}

export async function rejectPlanVersion(planVersionId: string): Promise<void> {
  const supabase = createClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw userErr ?? new Error("Not authenticated");

  const { error } = await supabase
    .from("project_plan_versions")
    .update({
      status: "rejected",
      approved_by: userRes.user.id,
      rejected_at: new Date().toISOString(),
      active: false
    })
    .eq("id", planVersionId);
  if (error) throw error;
}

export async function getPlanChannelInputs(planVersionId: string): Promise<PlanChannelInputs[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_plan_channel_inputs")
    .select("plan_version_id, channel, expected_leads, qualification_percent, target_contribution_percent, allocated_budget")
    .eq("plan_version_id", planVersionId);
  if (error) throw error;
  return (data as PlanChannelInputs[]) ?? [];
}

export async function upsertPlanChannelInputs(input: PlanChannelInputs): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_plan_channel_inputs")
    .upsert(input, { onConflict: "plan_version_id,channel" });
  if (error) throw error;
}

export async function getProjectActuals(
  projectId: string,
  year: number,
  month: number
): Promise<ProjectActuals | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_actuals")
    .select("project_id, year, month, leads, qualified_leads, meetings_scheduled, meetings_done")
    .eq("project_id", projectId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectActuals | null) ?? null;
}

export async function upsertProjectActuals(input: ProjectActuals): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_actuals").upsert(input, { onConflict: "project_id,year,month" });
  if (error) throw error;
}

