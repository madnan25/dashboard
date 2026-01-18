import { createBrowserDbClient } from "@/lib/db/client/browser";
import { createDashboardRepo } from "@/lib/db/repo";
import type {
  ProjectActualsChannelInput,
  ProjectActualsDigitalSourceInput,
  ProjectActualsMetricsInput,
  ProjectActualsSpendInput
} from "@/lib/db/repo/actuals";
import type { CreateSalesAttributionEventInput } from "@/lib/db/repo/attribution";
import type { CreateTaskInput, ListTasksFilters, UpdateTaskPatch } from "@/lib/db/repo/tasks";
export type {
  DigitalSource,
  PlanChannel,
  PlanChannelInputs,
  PlanStatus,
  PlanVersion,
  Profile,
  Project,
  ProjectActuals,
  ProjectActualsChannel,
  ProjectActualsDigitalSource,
  ProjectTargets,
  TaskTeam,
  Task,
  TaskApprovalState,
  TaskContribution,
  TaskContributionRole,
  TaskEvent,
  TaskFlowApproverKind,
  TaskFlowInstance,
  TaskFlowStepInstance,
  TaskFlowStepStatus,
  TaskFlowTemplate,
  TaskFlowTemplateStep,
  TaskPointsLedgerEntry,
  TaskPriority,
  TaskStatus,
  TaskSubtask,
  TaskSubtaskStatus,
  TaskWeightConfig,
  TaskWeightTier,
  UserRole
} from "@/lib/db/types";
import type {
  DigitalSource,
  PlanChannelInputs,
  PlanStatus,
  PlanVersion,
  Profile,
  Project,
  ProjectActuals,
  ProjectActualsChannel,
  ProjectActualsDigitalSource,
  ProjectTargets,
  TaskTeam,
  Task,
  TaskContribution,
  TaskContributionRole,
  TaskEvent,
  TaskFlowInstance,
  TaskFlowStepInstance,
  TaskFlowTemplate,
  TaskFlowTemplateStep,
  TaskPointsLedgerEntry,
  TaskWeightConfig,
  TaskSubtask,
  TaskSubtaskStatus,
  UserRole
} from "@/lib/db/types";

function repo() {
  // Backwards-compatible adapter: existing code expects browser-side access.
  // New code should prefer injecting a server or browser client directly.
  return createDashboardRepo(createBrowserDbClient());
}

export async function getCurrentProfile(): Promise<Profile | null> {
  return await repo().getCurrentProfile();
}

export async function updateMyFullName(full_name: string): Promise<void> {
  return await repo().updateMyFullName(full_name);
}

export async function listProfiles(): Promise<Profile[]> {
  return await repo().listProfiles();
}

export async function listProfilesByIds(ids: string[]): Promise<Profile[]> {
  return await repo().listProfilesByIds(ids);
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  return await repo().updateUserRole(userId, role);
}

export async function updateUserIsMarketingTeam(userId: string, isMarketing: boolean): Promise<void> {
  return await repo().updateUserIsMarketingTeam(userId, isMarketing);
}

export async function updateUserIsMarketingManager(userId: string, isManager: boolean): Promise<void> {
  return await repo().updateUserIsMarketingManager(userId, isManager);
}

export async function listProjects(): Promise<Project[]> {
  return await repo().listProjects();
}

export async function createProject(name: string): Promise<Project> {
  return await repo().createProject(name);
}

export async function updateProject(projectId: string, patch: Partial<Pick<Project, "name" | "is_active">>): Promise<void> {
  return await repo().updateProject(projectId, patch);
}

export async function getProjectTargets(projectId: string, year: number, month: number): Promise<ProjectTargets | null> {
  return await repo().getProjectTargets(projectId, year, month);
}

export async function upsertProjectTargets(input: ProjectTargets): Promise<void> {
  return await repo().upsertProjectTargets(input);
}

export async function listPlanVersions(projectId: string, year: number, month: number): Promise<PlanVersion[]> {
  return await repo().listPlanVersions(projectId, year, month);
}

export async function createDraftPlanVersion(projectId: string, year: number, month: number): Promise<PlanVersion> {
  return await repo().createDraftPlanVersion(projectId, year, month);
}

export async function updatePlanVersionStatus(planVersionId: string, status: PlanStatus): Promise<void> {
  return await repo().updatePlanVersionStatus(planVersionId, status);
}

export async function approvePlanVersion(planVersionId: string): Promise<void> {
  return await repo().approvePlanVersion(planVersionId);
}

export async function rejectPlanVersion(planVersionId: string): Promise<void> {
  return await repo().rejectPlanVersion(planVersionId);
}

export async function deletePlanVersion(planVersionId: string): Promise<void> {
  return await repo().deletePlanVersion(planVersionId);
}

// CMO-only hard delete (purge) via Edge Function (uses service role server-side)
export async function purgeDraftPlanVersion(planVersionId: string): Promise<void> {
  const supabase = createBrowserDbClient();
  const { data, error } = await supabase.functions.invoke("delete-plan-draft", {
    body: { planVersionId }
  });
  if (error) {
    // Supabase returns FunctionsHttpError with a Response in `context`
    const anyErr = error as unknown as { message?: string; context?: Response };
    const ctx = anyErr?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as { error?: unknown };
        if (typeof body?.error === "string" && body.error) throw new Error(body.error);
      } catch (e) {
        if (e instanceof Error) throw e;
      }
    }
    throw new Error(anyErr?.message || "Failed to purge plan version");
  }
  if (!data || data.ok !== true) {
    throw new Error((data && typeof data.error === "string" && data.error) || "Failed to purge draft plan");
  }
}

export async function getPlanChannelInputs(planVersionId: string): Promise<PlanChannelInputs[]> {
  return await repo().getPlanChannelInputs(planVersionId);
}

export async function upsertPlanChannelInputs(input: PlanChannelInputs): Promise<void> {
  return await repo().upsertPlanChannelInputs(input);
}

export async function getProjectActuals(
  projectId: string,
  year: number,
  month: number
): Promise<ProjectActuals | null> {
  return await repo().getProjectActuals(projectId, year, month);
}

export async function upsertProjectActuals(input: ProjectActuals): Promise<void> {
  return await repo().upsertProjectActuals(input);
}

export async function upsertProjectActualsMetrics(input: ProjectActualsMetricsInput): Promise<void> {
  return await repo().upsertProjectActualsMetrics(input);
}

export async function upsertProjectActualsSpend(input: ProjectActualsSpendInput): Promise<void> {
  return await repo().upsertProjectActualsSpend(input);
}

export async function listProjectActualsChannels(projectId: string, year: number, month: number): Promise<ProjectActualsChannel[]> {
  return await repo().listProjectActualsChannels(projectId, year, month);
}

export async function upsertProjectActualsChannels(inputs: ProjectActualsChannelInput[]): Promise<void> {
  return await repo().upsertProjectActualsChannels(inputs);
}

export async function listProjectActualsDigitalSources(projectId: string, year: number, month: number): Promise<ProjectActualsDigitalSource[]> {
  return await repo().listProjectActualsDigitalSources(projectId, year, month);
}

export async function upsertProjectActualsDigitalSources(inputs: ProjectActualsDigitalSourceInput[]): Promise<void> {
  return await repo().upsertProjectActualsDigitalSources(inputs);
}

export async function listSalesAttributionEvents(projectId: string, year: number, month: number) {
  return await repo().listSalesAttributionEvents(projectId, year, month);
}

export async function listTransferOutEvents(sourceProjectId: string, year: number, month: number) {
  return await repo().listTransferOutEvents(sourceProjectId, year, month);
}

export async function createSalesAttributionEvent(input: CreateSalesAttributionEventInput) {
  return await repo().createSalesAttributionEvent(input);
}

export async function deleteSalesAttributionEvent(id: string): Promise<void> {
  return await repo().deleteSalesAttributionEvent(id);
}

export async function listTasks(filters?: ListTasksFilters): Promise<Task[]> {
  return await repo().listTasks(filters);
}

export async function listTasksByIds(ids: string[]): Promise<Task[]> {
  return await repo().listTasksByIds(ids);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return await repo().createTask(input);
}

export async function updateTask(taskId: string, patch: UpdateTaskPatch): Promise<void> {
  return await repo().updateTask(taskId, patch);
}

export async function getTask(taskId: string): Promise<Task | null> {
  return await repo().getTask(taskId);
}

export async function deleteTask(taskId: string): Promise<void> {
  return await repo().deleteTask(taskId);
}

export async function listTaskEvents(taskId: string): Promise<TaskEvent[]> {
  return await repo().listTaskEvents(taskId);
}

export async function listTaskTeams(): Promise<TaskTeam[]> {
  return await repo().listTaskTeams();
}

export async function createTaskTeam(input: { name: string; description?: string | null; approver_user_id?: string | null }): Promise<TaskTeam> {
  return await repo().createTaskTeam(input);
}

export async function updateTaskTeam(
  id: string,
  patch: { name?: string; description?: string | null; approver_user_id?: string | null }
): Promise<void> {
  return await repo().updateTaskTeam(id, patch);
}

export async function deleteTaskTeam(id: string): Promise<void> {
  return await repo().deleteTaskTeam(id);
}

export async function getTaskWeightConfig(): Promise<TaskWeightConfig> {
  return await repo().getTaskWeightConfig();
}

export async function updateTaskWeightConfig(patch: Partial<TaskWeightConfig>): Promise<void> {
  return await repo().updateTaskWeightConfig(patch);
}

export async function listTaskPointsLedger(filters?: { userId?: string; weekStart?: string }): Promise<TaskPointsLedgerEntry[]> {
  return await repo().listTaskPointsLedger(filters);
}

export async function listTaskPointsLedgerByTaskId(taskId: string): Promise<TaskPointsLedgerEntry[]> {
  return await repo().listTaskPointsLedgerByTaskId(taskId);
}

export async function listTaskContributions(taskId: string): Promise<TaskContribution[]> {
  return await repo().listTaskContributions(taskId);
}

export async function upsertTaskContributions(
  taskId: string,
  entries: Array<{ role: TaskContributionRole; user_id: string }>
): Promise<void> {
  return await repo().upsertTaskContributions(taskId, entries);
}

export async function deleteTaskContributionByRole(taskId: string, role: TaskContributionRole): Promise<void> {
  return await repo().deleteTaskContributionByRole(taskId, role);
}

export async function listTaskSubtasks(taskId: string): Promise<TaskSubtask[]> {
  return await repo().listTaskSubtasks(taskId);
}

export async function createTaskSubtask(input: {
  task_id: string;
  title: string;
  status?: TaskSubtaskStatus;
  assignee_id?: string | null;
  due_at?: string | null;
  effort_points?: number;
}): Promise<TaskSubtask> {
  return await repo().createTaskSubtask(input);
}

export async function updateTaskSubtask(
  id: string,
  patch: Partial<Pick<TaskSubtask, "title" | "status" | "assignee_id" | "due_at" | "effort_points">>
): Promise<void> {
  return await repo().updateTaskSubtask(id, patch);
}

export async function deleteTaskSubtask(id: string): Promise<void> {
  return await repo().deleteTaskSubtask(id);
}

export async function listTaskFlowTemplates(): Promise<TaskFlowTemplate[]> {
  return await repo().listTaskFlowTemplates();
}

export async function listTaskFlowTemplateSteps(templateId: string): Promise<TaskFlowTemplateStep[]> {
  return await repo().listTaskFlowTemplateSteps(templateId);
}

export async function createTaskFlowTemplate(input: { name: string; description?: string | null }): Promise<TaskFlowTemplate> {
  return await repo().createTaskFlowTemplate(input);
}

export async function updateTaskFlowTemplate(id: string, patch: { name?: string; description?: string | null }): Promise<void> {
  return await repo().updateTaskFlowTemplate(id, patch);
}

export async function deleteTaskFlowTemplate(id: string): Promise<void> {
  return await repo().deleteTaskFlowTemplate(id);
}

export async function replaceTaskFlowTemplateSteps(
  templateId: string,
  steps: Array<{
    step_order: number;
    step_key: string;
    label: string;
    approver_kind: "marketing_manager" | "user" | "ticket_manager";
    approver_user_id: string | null;
  }>
): Promise<void> {
  return await repo().replaceTaskFlowTemplateSteps(templateId, steps);
}

export async function getTaskFlowInstance(taskId: string): Promise<TaskFlowInstance | null> {
  return await repo().getTaskFlowInstance(taskId);
}

export async function listTaskFlowInstancesByTaskIds(taskIds: string[]): Promise<TaskFlowInstance[]> {
  return await repo().listTaskFlowInstancesByTaskIds(taskIds);
}

export async function listTaskFlowStepInstances(flowInstanceId: string): Promise<TaskFlowStepInstance[]> {
  return await repo().listTaskFlowStepInstances(flowInstanceId);
}

export async function createTaskFlowInstanceFromTemplate(
  taskId: string,
  templateId: string,
  resolvedSteps: Array<{ step_order: number; step_key: string; label: string; approver_user_id: string | null }>
): Promise<TaskFlowInstance> {
  return await repo().createTaskFlowInstanceFromTemplate(taskId, templateId, resolvedSteps);
}

export async function approveTaskFlowStep(stepInstanceId: string): Promise<void> {
  return await repo().approveTaskFlowStep(stepInstanceId);
}

export async function cmoCreateUser(input: { email: string; role: UserRole; full_name?: string | null }): Promise<{ userId: string }> {
  const res = await fetch("/api/cmo/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = (await res.json().catch(() => ({}))) as { userId?: string; error?: string };
  if (!res.ok) throw new Error(body.error || "Failed to create user");
  if (!body.userId) throw new Error("Failed to create user");
  return { userId: body.userId };
}

