import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskApprovalState, TaskPriority, TaskStatus, TaskEvent, TaskPointsLedgerEntry, TaskWeightConfig } from "@/lib/db/types";

export type ListTasksFilters = {
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  approvalStates?: TaskApprovalState[];
  assigneeId?: string | null;
  projectId?: string | null;
  dueFrom?: string; // yyyy-mm-dd
  dueTo?: string; // yyyy-mm-dd
};

export async function listTasks(supabase: SupabaseClient, filters?: ListTasksFilters): Promise<Task[]> {
  let q = supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, approval_state, approved_by, approved_at, assignee_id, project_id, due_at, weight_tier, base_weight, completed_at, created_by, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });

  const f = filters ?? {};
  if (f.statuses && f.statuses.length > 0) q = q.in("status", f.statuses);
  if (f.priorities && f.priorities.length > 0) q = q.in("priority", f.priorities);
  if (f.approvalStates && f.approvalStates.length > 0) q = q.in("approval_state", f.approvalStates);
  if (f.assigneeId === null) q = q.is("assignee_id", null);
  if (typeof f.assigneeId === "string") q = q.eq("assignee_id", f.assigneeId);
  if (f.projectId === null) q = q.is("project_id", null);
  if (typeof f.projectId === "string") q = q.eq("project_id", f.projectId);
  if (f.dueFrom) q = q.gte("due_at", f.dueFrom);
  if (f.dueTo) q = q.lte("due_at", f.dueTo);

  const { data, error } = await q;
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export type CreateTaskInput = Pick<Task, "title"> &
  Partial<Pick<Task, "description" | "priority" | "status" | "approval_state" | "assignee_id" | "project_id" | "due_at">>;

export async function createTask(supabase: SupabaseClient, input: CreateTaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "p2",
      status: input.status ?? "queued",
      approval_state: input.approval_state ?? "pending",
      assignee_id: input.assignee_id ?? null,
      project_id: input.project_id ?? null,
      due_at: input.due_at ?? null
    })
    .select(
      "id, title, description, priority, status, approval_state, approved_by, approved_at, assignee_id, project_id, due_at, weight_tier, base_weight, completed_at, created_by, created_at, updated_at"
    )
    .single();
  if (error) throw error;
  return data as Task;
}

export type UpdateTaskPatch = Partial<
  Pick<Task, "title" | "description" | "priority" | "status" | "approval_state" | "assignee_id" | "project_id" | "due_at">
>;

export async function updateTask(supabase: SupabaseClient, id: string, patch: UpdateTaskPatch): Promise<void> {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function getTask(supabase: SupabaseClient, id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, approval_state, approved_by, approved_at, assignee_id, project_id, due_at, weight_tier, base_weight, completed_at, created_by, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Task | null) ?? null;
}

export async function getTaskWeightConfig(supabase: SupabaseClient): Promise<TaskWeightConfig> {
  const { data, error } = await supabase.from("task_weight_config").select("*").eq("id", "global").single();
  if (error) throw error;
  return data as TaskWeightConfig;
}

export async function updateTaskWeightConfig(supabase: SupabaseClient, patch: Partial<TaskWeightConfig>): Promise<void> {
  const { error } = await supabase.from("task_weight_config").update(patch).eq("id", "global");
  if (error) throw error;
}

export async function listTaskPointsLedger(
  supabase: SupabaseClient,
  filters?: { userId?: string; weekStart?: string }
): Promise<TaskPointsLedgerEntry[]> {
  let q = supabase
    .from("task_points_ledger")
    .select("id, user_id, task_id, weight_tier, points_awarded, breakdown, week_start, created_at")
    .order("created_at", { ascending: false });
  if (filters?.userId) q = q.eq("user_id", filters.userId);
  if (filters?.weekStart) q = q.eq("week_start", filters.weekStart);
  const { data, error } = await q;
  if (error) throw error;
  return (data as TaskPointsLedgerEntry[]) ?? [];
}

export async function deleteTask(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function listTaskEvents(supabase: SupabaseClient, taskId: string): Promise<TaskEvent[]> {
  const { data, error } = await supabase
    .from("task_events")
    .select("id, task_id, actor_id, type, from_value, to_value, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TaskEvent[]) ?? [];
}

