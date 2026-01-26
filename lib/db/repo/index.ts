import type { SupabaseClient } from "@supabase/supabase-js";

import * as profiles from "./profiles";
import * as projects from "./projects";
import * as targets from "./targets";
import * as plans from "./plans";
import * as actuals from "./actuals";
import * as attribution from "./attribution";
import * as tasks from "./tasks";

export function createDashboardRepo(supabase: SupabaseClient) {
  return {
    // profiles
    getCurrentProfile: () => profiles.getCurrentProfile(supabase),
    updateMyFullName: (full_name: string) => profiles.updateMyFullName(supabase, full_name),
    listProfiles: () => profiles.listProfiles(supabase),
    listProfilesByIds: (ids: string[]) => profiles.listProfilesByIds(supabase, ids),
    updateUserRole: (userId: string, role: Parameters<typeof profiles.updateUserRole>[2]) =>
      profiles.updateUserRole(supabase, userId, role),
    updateUserIsMarketingTeam: (userId: string, isMarketing: boolean) => profiles.updateUserIsMarketingTeam(supabase, userId, isMarketing),
    updateUserIsMarketingManager: (userId: string, isManager: boolean) => profiles.updateUserIsMarketingManager(supabase, userId, isManager),

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
      actuals.upsertProjectActualsChannels(supabase, inputs),
    listProjectActualsDigitalSources: (projectId: string, year: number, month: number) =>
      actuals.listProjectActualsDigitalSources(supabase, projectId, year, month),
    upsertProjectActualsDigitalSources: (inputs: Parameters<typeof actuals.upsertProjectActualsDigitalSources>[1]) =>
      actuals.upsertProjectActualsDigitalSources(supabase, inputs),

    // attribution + misc (Sales Ops)
    listSalesAttributionEvents: (projectId: string, year: number, month: number) =>
      attribution.listSalesAttributionEvents(supabase, projectId, year, month),
    listTransferOutEvents: (sourceProjectId: string, year: number, month: number) =>
      attribution.listTransferOutEvents(supabase, sourceProjectId, year, month),
    createSalesAttributionEvent: (input: Parameters<typeof attribution.createSalesAttributionEvent>[1]) =>
      attribution.createSalesAttributionEvent(supabase, input),
    deleteSalesAttributionEvent: (id: string) => attribution.deleteSalesAttributionEvent(supabase, id),

    // tasks
    listTasks: (filters?: Parameters<typeof tasks.listTasks>[1]) => tasks.listTasks(supabase, filters),
    listTasksByIds: (ids: string[]) => tasks.listTasksByIds(supabase, ids),
    createTask: (input: Parameters<typeof tasks.createTask>[1]) => tasks.createTask(supabase, input),
    nextDesignTicketNumber: () => tasks.nextDesignTicketNumber(supabase),
    nextProductionTicketNumber: () => tasks.nextProductionTicketNumber(supabase),
    nextTeamTicketNumber: (prefix: string) => tasks.nextTeamTicketNumber(supabase, prefix),
    updateTask: (id: string, patch: Parameters<typeof tasks.updateTask>[2]) => tasks.updateTask(supabase, id, patch),
    getTask: (id: string) => tasks.getTask(supabase, id),
    deleteTask: (id: string) => tasks.deleteTask(supabase, id),
    listMasterCalendarTasks: (filters?: Parameters<typeof tasks.listMasterCalendarTasks>[1]) =>
      tasks.listMasterCalendarTasks(supabase, filters),
    listTaskEvents: (taskId: string) => tasks.listTaskEvents(supabase, taskId),
    listTaskComments: (taskId: string) => tasks.listTaskComments(supabase, taskId),
    createTaskComment: (input: Parameters<typeof tasks.createTaskComment>[1]) => tasks.createTaskComment(supabase, input),
    updateTaskComment: (id: string, patch: Parameters<typeof tasks.updateTaskComment>[2]) =>
      tasks.updateTaskComment(supabase, id, patch),
    deleteTaskComment: (id: string) => tasks.deleteTaskComment(supabase, id),
    listTaskTeams: () => tasks.listTaskTeams(supabase),
    createTaskTeam: (input: Parameters<typeof tasks.createTaskTeam>[1]) => tasks.createTaskTeam(supabase, input),
    updateTaskTeam: (id: string, patch: Parameters<typeof tasks.updateTaskTeam>[2]) => tasks.updateTaskTeam(supabase, id, patch),
    deleteTaskTeam: (id: string) => tasks.deleteTaskTeam(supabase, id),

    // tasks scoring
    getTaskWeightConfig: () => tasks.getTaskWeightConfig(supabase),
    updateTaskWeightConfig: (patch: Parameters<typeof tasks.updateTaskWeightConfig>[1]) => tasks.updateTaskWeightConfig(supabase, patch),
    listTaskPointsLedger: (filters?: Parameters<typeof tasks.listTaskPointsLedger>[1]) => tasks.listTaskPointsLedger(supabase, filters),
    listTaskPointsLedgerByTaskId: (taskId: string) => tasks.listTaskPointsLedgerByTaskId(supabase, taskId),

    // tasks collaboration
    listTaskContributions: (taskId: string) => tasks.listTaskContributions(supabase, taskId),
    upsertTaskContributions: (taskId: string, entries: Parameters<typeof tasks.upsertTaskContributions>[2]) =>
      tasks.upsertTaskContributions(supabase, taskId, entries),
    deleteTaskContributionByRole: (taskId: string, role: Parameters<typeof tasks.deleteTaskContributionByRole>[2]) =>
      tasks.deleteTaskContributionByRole(supabase, taskId, role),
    listTaskSubtasks: (taskId: string) => tasks.listTaskSubtasks(supabase, taskId),
    getLinkedParentSubtask: (linkedTaskId: string) => tasks.getLinkedParentSubtask(supabase, linkedTaskId),
    createTaskSubtask: (input: Parameters<typeof tasks.createTaskSubtask>[1]) => tasks.createTaskSubtask(supabase, input),
    updateTaskSubtask: (id: string, patch: Parameters<typeof tasks.updateTaskSubtask>[2]) => tasks.updateTaskSubtask(supabase, id, patch),
    deleteTaskSubtask: (id: string) => tasks.deleteTaskSubtask(supabase, id),
    // tasks flow
    listTaskFlowTemplates: () => tasks.listTaskFlowTemplates(supabase),
    listTaskFlowTemplateSteps: (templateId: string) => tasks.listTaskFlowTemplateSteps(supabase, templateId),
    createTaskFlowTemplate: (input: Parameters<typeof tasks.createTaskFlowTemplate>[1]) => tasks.createTaskFlowTemplate(supabase, input),
    updateTaskFlowTemplate: (id: string, patch: Parameters<typeof tasks.updateTaskFlowTemplate>[2]) => tasks.updateTaskFlowTemplate(supabase, id, patch),
    deleteTaskFlowTemplate: (id: string) => tasks.deleteTaskFlowTemplate(supabase, id),
    replaceTaskFlowTemplateSteps: (templateId: string, steps: Parameters<typeof tasks.replaceTaskFlowTemplateSteps>[2]) =>
      tasks.replaceTaskFlowTemplateSteps(supabase, templateId, steps),
    getTaskFlowInstance: (taskId: string) => tasks.getTaskFlowInstance(supabase, taskId),
    listTaskFlowInstancesByTaskIds: (taskIds: string[]) => tasks.listTaskFlowInstancesByTaskIds(supabase, taskIds),
    listTaskFlowStepInstances: (flowInstanceId: string) => tasks.listTaskFlowStepInstances(supabase, flowInstanceId),
    createTaskFlowInstanceFromTemplate: (
      taskId: string,
      templateId: string,
      resolvedSteps: Parameters<typeof tasks.createTaskFlowInstanceFromTemplate>[3]
    ) => tasks.createTaskFlowInstanceFromTemplate(supabase, taskId, templateId, resolvedSteps),
    approveTaskFlowStep: (stepInstanceId: string) => tasks.approveTaskFlowStep(supabase, stepInstanceId)
  };
}

