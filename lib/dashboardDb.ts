import { createBrowserDbClient } from "@/lib/db/client/browser";
import { createDashboardRepo } from "@/lib/db/repo";
export type {
  PlanChannel,
  PlanChannelInputs,
  PlanStatus,
  PlanVersion,
  Profile,
  Project,
  ProjectActuals,
  ProjectTargets,
  UserRole
} from "@/lib/db/types";
import type {
  PlanChannelInputs,
  PlanStatus,
  PlanVersion,
  Profile,
  Project,
  ProjectActuals,
  ProjectTargets
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

