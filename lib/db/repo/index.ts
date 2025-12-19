import type { SupabaseClient } from "@supabase/supabase-js";

import * as profiles from "./profiles";
import * as projects from "./projects";
import * as targets from "./targets";
import * as plans from "./plans";
import * as actuals from "./actuals";

export function createDashboardRepo(supabase: SupabaseClient) {
  return {
    // profiles
    getCurrentProfile: () => profiles.getCurrentProfile(supabase),
    updateMyFullName: (full_name: string) => profiles.updateMyFullName(supabase, full_name),
    listProfiles: () => profiles.listProfiles(supabase),
    listProfilesByIds: (ids: string[]) => profiles.listProfilesByIds(supabase, ids),
    updateUserRole: (userId: string, role: Parameters<typeof profiles.updateUserRole>[2]) =>
      profiles.updateUserRole(supabase, userId, role),

    // projects
    listProjects: () => projects.listProjects(supabase),
    createProject: (name: string) => projects.createProject(supabase, name),
    updateProject: (projectId: string, patch: Parameters<typeof projects.updateProject>[2]) =>
      projects.updateProject(supabase, projectId, patch),

    // targets
    getProjectTargets: (projectId: string, year: number, month: number) => targets.getProjectTargets(supabase, projectId, year, month),
    upsertProjectTargets: (input: Parameters<typeof targets.upsertProjectTargets>[1]) => targets.upsertProjectTargets(supabase, input),

    // plans
    listPlanVersions: (projectId: string, year: number, month: number) => plans.listPlanVersions(supabase, projectId, year, month),
    createDraftPlanVersion: (projectId: string, year: number, month: number) => plans.createDraftPlanVersion(supabase, projectId, year, month),
    updatePlanVersionStatus: (planVersionId: string, status: Parameters<typeof plans.updatePlanVersionStatus>[2]) =>
      plans.updatePlanVersionStatus(supabase, planVersionId, status),
    approvePlanVersion: (planVersionId: string) => plans.approvePlanVersion(supabase, planVersionId),
    rejectPlanVersion: (planVersionId: string) => plans.rejectPlanVersion(supabase, planVersionId),
    deletePlanVersion: (planVersionId: string) => plans.deletePlanVersion(supabase, planVersionId),
    getPlanChannelInputs: (planVersionId: string) => plans.getPlanChannelInputs(supabase, planVersionId),
    upsertPlanChannelInputs: (input: Parameters<typeof plans.upsertPlanChannelInputs>[1]) => plans.upsertPlanChannelInputs(supabase, input),

    // actuals
    getProjectActuals: (projectId: string, year: number, month: number) => actuals.getProjectActuals(supabase, projectId, year, month),
    upsertProjectActuals: (input: Parameters<typeof actuals.upsertProjectActuals>[1]) => actuals.upsertProjectActuals(supabase, input),
    upsertProjectActualsMetrics: (input: Parameters<typeof actuals.upsertProjectActualsMetrics>[1]) => actuals.upsertProjectActualsMetrics(supabase, input),
    upsertProjectActualsSpend: (input: Parameters<typeof actuals.upsertProjectActualsSpend>[1]) => actuals.upsertProjectActualsSpend(supabase, input),
    listProjectActualsChannels: (projectId: string, year: number, month: number) =>
      actuals.listProjectActualsChannels(supabase, projectId, year, month),
    upsertProjectActualsChannels: (inputs: Parameters<typeof actuals.upsertProjectActualsChannels>[1]) =>
      actuals.upsertProjectActualsChannels(supabase, inputs)
  };
}

