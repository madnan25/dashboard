import { createBrowserDbClient } from "@/lib/db/client/browser";
import { createDashboardRepo } from "@/lib/db/repo";
import type {
  ProjectActualsChannelInput,
  ProjectActualsDigitalSourceInput,
  ProjectActualsMetricsInput,
  ProjectActualsSpendInput
} from "@/lib/db/repo/actuals";
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
  Task,
  TaskApprovalState,
  TaskEvent,
  TaskPriority,
  TaskStatus,
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
  Task,
  TaskEvent,
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

export async function updateUserCanManageTasks(userId: string, canManage: boolean): Promise<void> {
  return await repo().updateUserCanManageTasks(userId, canManage);
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

export async function listTasks(filters?: ListTasksFilters): Promise<Task[]> {
  return await repo().listTasks(filters);
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

