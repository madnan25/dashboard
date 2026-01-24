import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Task,
  TaskApprovalState,
  TaskPriority,
  TaskStatus,
  TaskEvent,
  TaskPointsLedgerEntry,
  TaskWeightConfig,
  TaskContribution,
  TaskContributionRole,
  TaskSubtask,
  TaskSubtaskStatus,
  TaskTeam,
  TaskComment,
  MasterCalendarTask
} from "@/lib/db/types";
import type { TaskFlowInstance, TaskFlowStepInstance, TaskFlowTemplate, TaskFlowTemplateStep } from "@/lib/db/types";

export type ListTasksFilters = {
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  approvalStates?: TaskApprovalState[];
  assigneeId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  dueFrom?: string; // yyyy-mm-dd
  dueTo?: string; // yyyy-mm-dd
};

export async function listTasks(supabase: SupabaseClient, filters?: ListTasksFilters): Promise<Task[]> {
  let q = supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, approval_state, approved_by, approved_at, team_id, approver_user_id, assignee_id, project_id, due_at, master_calendar_tag, weight_tier, base_weight, completed_at, created_by, created_at, updated_at"
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
  if (f.teamId === null) q = q.is("team_id", null);
  if (typeof f.teamId === "string") q = q.eq("team_id", f.teamId);
  if (f.dueFrom) q = q.gte("due_at", f.dueFrom);
  if (f.dueTo) q = q.lte("due_at", f.dueTo);

  const { data, error } = await q;
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export async function listTasksByIds(supabase: SupabaseClient, ids: string[]): Promise<Task[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, approval_state, approved_by, approved_at, team_id, approver_user_id, assignee_id, project_id, due_at, master_calendar_tag, weight_tier, base_weight, completed_at, created_by, created_at, updated_at"
    )
    .in("id", unique);
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export type CreateTaskInput = Pick<Task, "title"> &
  Partial<
    Pick<
      Task,
      "description" | "priority" | "status" | "approval_state" | "assignee_id" | "project_id" | "due_at" | "team_id" | "master_calendar_tag"
    >
  >;

export async function createTask(supabase: SupabaseClient, input: CreateTaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "p2",
      status: input.status ?? "queued",
      approval_state: input.approval_state ?? "pending",
      team_id: input.team_id ?? null,
      assignee_id: input.assignee_id ?? null,
      project_id: input.project_id ?? null,
      due_at: input.due_at ?? null,
      master_calendar_tag: input.master_calendar_tag ?? null
    })
    .select(
      "id, title, description, priority, status, approval_state, approved_by, approved_at, team_id, approver_user_id, assignee_id, project_id, due_at, master_calendar_tag, weight_tier, base_weight, completed_at, created_by, created_at, updated_at"
    )
    .single();
  if (error) throw error;
  return data as Task;
}

export type UpdateTaskPatch = Partial<
  Pick<
    Task,
    "title" | "description" | "priority" | "status" | "approval_state" | "assignee_id" | "project_id" | "due_at" | "team_id" | "master_calendar_tag"
  >
>;

export async function updateTask(supabase: SupabaseClient, id: string, patch: UpdateTaskPatch): Promise<void> {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function getTask(supabase: SupabaseClient, id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, approval_state, approved_by, approved_at, team_id, approver_user_id, assignee_id, project_id, due_at, master_calendar_tag, weight_tier, base_weight, completed_at, created_by, created_at, updated_at"
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

export async function listTaskPointsLedgerByTaskId(supabase: SupabaseClient, taskId: string): Promise<TaskPointsLedgerEntry[]> {
  const { data, error } = await supabase
    .from("task_points_ledger")
    .select("id, user_id, task_id, weight_tier, points_awarded, breakdown, week_start, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TaskPointsLedgerEntry[]) ?? [];
}

export async function deleteTask(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// --- Master calendar (read-only) ---

export async function listMasterCalendarTasks(
  supabase: SupabaseClient,
  filters?: { dueFrom?: string; dueTo?: string }
): Promise<MasterCalendarTask[]> {
  const { data, error } = await supabase.rpc("list_master_calendar_tasks", {
    p_due_from: filters?.dueFrom ?? null,
    p_due_to: filters?.dueTo ?? null
  });
  if (error) throw error;
  return (data as MasterCalendarTask[]) ?? [];
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

export async function listTaskComments(supabase: SupabaseClient, taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, task_id, author_id, body, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as TaskComment[]) ?? [];
}

export async function createTaskComment(
  supabase: SupabaseClient,
  input: Pick<TaskComment, "task_id" | "body">
): Promise<TaskComment> {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ task_id: input.task_id, body: input.body })
    .select("id, task_id, author_id, body, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as TaskComment;
}

export async function updateTaskComment(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<TaskComment, "body">>
): Promise<void> {
  const { error } = await supabase.from("task_comments").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskComment(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("task_comments").delete().eq("id", id);
  if (error) throw error;
}

// --- Teams ---

export async function listTaskTeams(supabase: SupabaseClient): Promise<TaskTeam[]> {
  const { data, error } = await supabase
    .from("task_teams")
    .select("id, name, description, approver_user_id, created_by, created_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as TaskTeam[]) ?? [];
}

export async function createTaskTeam(
  supabase: SupabaseClient,
  input: Pick<TaskTeam, "name"> & Partial<Pick<TaskTeam, "description" | "approver_user_id">>
): Promise<TaskTeam> {
  const { data, error } = await supabase
    .from("task_teams")
    .insert({
      name: input.name,
      description: input.description ?? null,
      approver_user_id: input.approver_user_id ?? null
    })
    .select("id, name, description, approver_user_id, created_by, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as TaskTeam;
}

export async function updateTaskTeam(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<TaskTeam, "name" | "description" | "approver_user_id">>
): Promise<void> {
  const { error } = await supabase.from("task_teams").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskTeam(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("task_teams").delete().eq("id", id);
  if (error) throw error;
}

export async function listTaskContributions(supabase: SupabaseClient, taskId: string): Promise<TaskContribution[]> {
  const { data, error } = await supabase
    .from("task_contributions")
    .select("id, task_id, user_id, role, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as TaskContribution[]) ?? [];
}

export async function upsertTaskContributions(
  supabase: SupabaseClient,
  taskId: string,
  entries: Array<{ role: TaskContributionRole; user_id: string }>
): Promise<void> {
  const payload = entries.map((e) => ({ task_id: taskId, role: e.role, user_id: e.user_id }));
  const { error } = await supabase.from("task_contributions").upsert(payload, { onConflict: "task_id,role" });
  if (error) throw error;
}

export async function deleteTaskContributionByRole(
  supabase: SupabaseClient,
  taskId: string,
  role: TaskContributionRole
): Promise<void> {
  const { error } = await supabase.from("task_contributions").delete().eq("task_id", taskId).eq("role", role);
  if (error) throw error;
}

export async function listTaskSubtasks(supabase: SupabaseClient, taskId: string): Promise<TaskSubtask[]> {
  const { data, error } = await supabase
    .from("task_subtasks")
    .select("id, task_id, title, description, status, assignee_id, due_at, effort_points, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as TaskSubtask[]) ?? [];
}

export type CreateTaskSubtaskInput = {
  task_id: string;
  title: string;
  description?: string | null;
  status?: TaskSubtaskStatus;
  assignee_id?: string | null;
  due_at?: string | null;
  effort_points?: number;
};

export async function createTaskSubtask(supabase: SupabaseClient, input: CreateTaskSubtaskInput): Promise<TaskSubtask> {
  const { data, error } = await supabase
    .from("task_subtasks")
    .insert({
      task_id: input.task_id,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "not_done",
      assignee_id: input.assignee_id ?? null,
      due_at: input.due_at ?? null,
      effort_points: Math.max(0, Math.trunc(input.effort_points ?? 0))
    })
    .select("id, task_id, title, description, status, assignee_id, due_at, effort_points, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as TaskSubtask;
}

export async function updateTaskSubtask(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<TaskSubtask, "title" | "description" | "status" | "assignee_id" | "due_at" | "effort_points">>
): Promise<void> {
  const { error } = await supabase.from("task_subtasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskSubtask(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("task_subtasks").delete().eq("id", id);
  if (error) throw error;
}

// --- Flow templates / instances ---

export async function listTaskFlowTemplates(supabase: SupabaseClient): Promise<TaskFlowTemplate[]> {
  const { data, error } = await supabase
    .from("task_flow_templates")
    .select("id, name, description, created_by, created_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as TaskFlowTemplate[]) ?? [];
}

export async function listTaskFlowTemplateSteps(supabase: SupabaseClient, templateId: string): Promise<TaskFlowTemplateStep[]> {
  const { data, error } = await supabase
    .from("task_flow_template_steps")
    .select("id, template_id, step_order, step_key, label, approver_kind, approver_user_id, created_at, updated_at")
    .eq("template_id", templateId)
    .order("step_order", { ascending: true });
  if (error) throw error;
  return (data as TaskFlowTemplateStep[]) ?? [];
}

export async function createTaskFlowTemplate(
  supabase: SupabaseClient,
  input: Pick<TaskFlowTemplate, "name"> & Partial<Pick<TaskFlowTemplate, "description">>
): Promise<TaskFlowTemplate> {
  const { data, error } = await supabase
    .from("task_flow_templates")
    .insert({ name: input.name, description: input.description ?? null })
    .select("id, name, description, created_by, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as TaskFlowTemplate;
}

export async function updateTaskFlowTemplate(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<TaskFlowTemplate, "name" | "description">>
): Promise<void> {
  const { error } = await supabase.from("task_flow_templates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskFlowTemplate(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("task_flow_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceTaskFlowTemplateSteps(
  supabase: SupabaseClient,
  templateId: string,
  steps: Array<Pick<TaskFlowTemplateStep, "step_order" | "step_key" | "label" | "approver_kind" | "approver_user_id">>
): Promise<void> {
  // Simple replace: delete then insert
  const { error: delErr } = await supabase.from("task_flow_template_steps").delete().eq("template_id", templateId);
  if (delErr) throw delErr;

  const payload = steps.map((s) => ({
    template_id: templateId,
    step_order: s.step_order,
    step_key: s.step_key,
    label: s.label,
    approver_kind: s.approver_kind,
    approver_user_id: s.approver_user_id ?? null
  }));
  if (payload.length === 0) return;
  const { error } = await supabase.from("task_flow_template_steps").insert(payload);
  if (error) throw error;
}

export async function getTaskFlowInstance(supabase: SupabaseClient, taskId: string): Promise<TaskFlowInstance | null> {
  const { data, error } = await supabase
    .from("task_flow_instances")
    .select("id, task_id, template_id, current_step_order, is_overridden, created_by, created_at, updated_at")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw error;
  return (data as TaskFlowInstance | null) ?? null;
}

export async function listTaskFlowInstancesByTaskIds(supabase: SupabaseClient, taskIds: string[]): Promise<TaskFlowInstance[]> {
  const unique = Array.from(new Set(taskIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("task_flow_instances")
    .select("id, task_id, template_id, current_step_order, is_overridden, created_by, created_at, updated_at")
    .in("task_id", unique);
  if (error) throw error;
  return (data as TaskFlowInstance[]) ?? [];
}

export async function listTaskFlowStepInstances(supabase: SupabaseClient, flowInstanceId: string): Promise<TaskFlowStepInstance[]> {
  const { data, error } = await supabase
    .from("task_flow_step_instances")
    .select("id, flow_instance_id, step_order, step_key, label, approver_user_id, status, approved_by, approved_at, created_at, updated_at")
    .eq("flow_instance_id", flowInstanceId)
    .order("step_order", { ascending: true });
  if (error) throw error;
  return (data as TaskFlowStepInstance[]) ?? [];
}

export async function createTaskFlowInstanceFromTemplate(
  supabase: SupabaseClient,
  taskId: string,
  templateId: string,
  resolvedSteps: Array<Pick<TaskFlowStepInstance, "step_order" | "step_key" | "label" | "approver_user_id">>
): Promise<TaskFlowInstance> {
  // New default: use server-side RPC to resolve approvers (e.g. ticket manager).
  // Keep resolvedSteps param for backwards compatibility; if provided, fall back to client-side path.
  if (!resolvedSteps || resolvedSteps.length === 0) {
    const { data, error } = await supabase.rpc("create_task_flow_instance_from_template", {
      p_task_id: taskId,
      p_template_id: templateId
    });
    if (error) throw error;
    const instId = data as string | null;
    if (!instId) throw new Error("Failed to create flow instance");
    const { data: inst, error: instErr } = await supabase
      .from("task_flow_instances")
      .select("id, task_id, template_id, current_step_order, is_overridden, created_by, created_at, updated_at")
      .eq("id", instId)
      .single();
    if (instErr) throw instErr;
    return inst as TaskFlowInstance;
  }

  // Legacy: client-resolved flow creation
  const { data: inst, error: instErr } = await supabase
    .from("task_flow_instances")
    .insert({ task_id: taskId, template_id: templateId, is_overridden: false })
    .select("id, task_id, template_id, current_step_order, is_overridden, created_by, created_at, updated_at")
    .single();
  if (instErr) throw instErr;

  const payload = resolvedSteps.map((s) => ({
    flow_instance_id: (inst as TaskFlowInstance).id,
    step_order: s.step_order,
    step_key: s.step_key,
    label: s.label,
    approver_user_id: s.approver_user_id ?? null
  }));
  if (payload.length > 0) {
    const { error } = await supabase.from("task_flow_step_instances").insert(payload);
    if (error) throw error;
  }

  return inst as TaskFlowInstance;
}

export async function approveTaskFlowStep(supabase: SupabaseClient, stepInstanceId: string): Promise<void> {
  const { error } = await supabase.from("task_flow_step_instances").update({ status: "approved" }).eq("id", stepInstanceId);
  if (error) throw error;
}

