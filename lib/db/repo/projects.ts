import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "@/lib/db/types";

export async function listProjects(supabase: SupabaseClient): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("id, name, is_active").order("name");
  if (error) throw error;
  return (data as Project[]) ?? [];
}

export async function createProject(supabase: SupabaseClient, name: string): Promise<Project> {
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

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  patch: Partial<Pick<Project, "name" | "is_active">>
): Promise<void> {
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) throw error;
}

