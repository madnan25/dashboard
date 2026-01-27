import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import type { Profile, Project, Task, TaskStatus, TaskTeam } from "@/lib/db/types";

const DEFAULT_RECENT_DAYS = 14;
const DEFAULT_TASK_LIMIT = 200;
const MAX_PROMPT_CHARS = 45000;

type TaskSummary = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  assignee: string;
  team: string;
  project: string;
  due_at: string | null;
  updated_at: string;
  description_snippet: string | null;
  latest_comment_snippet: string | null;
  latest_comment_at: string | null;
};

type BlockedTask = TaskSummary & {
  description_snippet: string | null;
  latest_comment_snippet: string | null;
};

export type TaskInsights = {
  generated_at: string;
  window: {
    recent_days: number;
    recent_cutoff: string;
    due_soon_cutoff: string;
    today: string;
  };
  counts: {
    total: number;
    open: number;
    closed: number;
    dropped: number;
    blocked: number;
    on_hold: number;
    overdue: number;
    due_soon: number;
    updated_recent: number;
  };
  by_status: Array<{ status: TaskStatus; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
  by_team: Array<{ id: string | null; name: string; total: number; open: number; blocked: number; overdue: number }>;
  by_assignee: Array<{ id: string | null; name: string; total: number; open: number; blocked: number; overdue: number }>;
  by_project: Array<{ id: string | null; name: string; total: number; open: number; blocked: number; overdue: number }>;
  tasks: TaskSummary[];
  blocked_tasks: BlockedTask[];
  recent_comments: Array<{
    task_id: string;
    title: string;
    created_at: string;
    snippet: string;
    assignee: string;
    team: string;
    project: string;
  }>;
  truncated: boolean;
};

type InsightsOptions = {
  recentDays?: number;
  taskLimit?: number;
  supabase?: SupabaseClient;
};

type CommentRow = {
  task_id: string;
  body: string;
  created_at: string;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isOpenStatus(status: TaskStatus) {
  return status !== "closed" && status !== "dropped";
}

function compactText(value: string | null | undefined, max = 180) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function nameOrFallback(value: string | null | undefined, fallback: string) {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed : fallback;
}

async function loadLatestComments(
  supabase: SupabaseClient,
  taskIds: string[]
): Promise<Map<string, CommentRow>> {
  const unique = Array.from(new Set(taskIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("task_comments")
    .select("task_id, body, created_at")
    .in("task_id", unique)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const map = new Map<string, CommentRow>();
  for (const row of (data as CommentRow[]) ?? []) {
    if (!map.has(row.task_id)) map.set(row.task_id, row);
  }
  return map;
}

function formatTaskSummary(
  t: Task,
  maps: ReturnType<typeof buildNameMaps>,
  latestComment: CommentRow | null
): TaskSummary {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority.toUpperCase(),
    assignee: maps.assigneeName(t.assignee_id),
    team: maps.teamName(t.team_id),
    project: maps.projectName(t.project_id),
    due_at: t.due_at ?? null,
    updated_at: t.updated_at,
    description_snippet: compactText(t.description),
    latest_comment_snippet: latestComment ? compactText(latestComment.body) : null,
    latest_comment_at: latestComment?.created_at ?? null
  };
}

function buildNameMaps(profiles: Profile[], teams: TaskTeam[], projects: Project[]) {
  const profileMap = new Map(profiles.map((p) => [p.id, nameOrFallback(p.full_name || p.email, p.id)]));
  const teamMap = new Map(teams.map((t) => [t.id, nameOrFallback(t.name, t.id)]));
  const projectMap = new Map(projects.map((p) => [p.id, nameOrFallback(p.name, p.id)]));

  return {
    assigneeName: (id: string | null | undefined) => (id ? profileMap.get(id) || `${id.slice(0, 8)}…` : "Unassigned"),
    teamName: (id: string | null | undefined) => (id ? teamMap.get(id) || `${id.slice(0, 8)}…` : "No team"),
    projectName: (id: string | null | undefined) => (id ? projectMap.get(id) || `${id.slice(0, 8)}…` : "No project")
  };
}

export async function buildTaskInsights(options: InsightsOptions = {}): Promise<TaskInsights> {
  const recentDays = options.recentDays ?? DEFAULT_RECENT_DAYS;
  const taskLimit = options.taskLimit ?? DEFAULT_TASK_LIMIT;

  const supabase = options.supabase ?? (await createServerDbClient());
  const repo = createDashboardRepo(supabase);

  const [tasks, profiles, projects, teams] = await Promise.all([
    repo.listTasks(),
    repo.listProfiles(),
    repo.listProjects(),
    repo.listTaskTeams()
  ]);

  const today = new Date();
  const todayIso = isoDate(today);
  const dueSoonIso = isoDate(addDays(today, 7));
  const recentCutoff = isoDate(addDays(today, -recentDays));

  const maps = buildNameMaps(profiles, teams, projects);

  const sorted = [...tasks].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  const truncated = sorted.length > taskLimit;
  const detailTasks = sorted.slice(0, taskLimit);

  const blockedTasks = tasks.filter((t) => t.status === "blocked" || t.status === "on_hold");
  const commentTaskIds = Array.from(
    new Set([...detailTasks, ...blockedTasks].map((t) => t.id))
  );
  const latestComments = await loadLatestComments(supabase, commentTaskIds);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const byStatus = new Map<TaskStatus, number>();
  const byPriority = new Map<string, number>();
  const byTeam = new Map<string | null, { total: number; open: number; blocked: number; overdue: number }>();
  const byAssignee = new Map<string | null, { total: number; open: number; blocked: number; overdue: number }>();
  const byProject = new Map<string | null, { total: number; open: number; blocked: number; overdue: number }>();

  let openCount = 0;
  let closedCount = 0;
  let droppedCount = 0;
  let blockedCount = 0;
  let onHoldCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let updatedRecentCount = 0;

  for (const t of tasks) {
    byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
    byPriority.set(t.priority.toUpperCase(), (byPriority.get(t.priority.toUpperCase()) ?? 0) + 1);

    const open = isOpenStatus(t.status);
    if (open) openCount += 1;
    if (t.status === "closed") closedCount += 1;
    if (t.status === "dropped") droppedCount += 1;
    if (t.status === "blocked") blockedCount += 1;
    if (t.status === "on_hold") onHoldCount += 1;

    const isOverdue = Boolean(open && t.due_at && t.due_at < todayIso);
    const isDueSoon = Boolean(open && t.due_at && t.due_at >= todayIso && t.due_at <= dueSoonIso);
    if (isOverdue) overdueCount += 1;
    if (isDueSoon) dueSoonCount += 1;
    if (t.updated_at >= recentCutoff) updatedRecentCount += 1;

    const teamEntry = byTeam.get(t.team_id ?? null) ?? { total: 0, open: 0, blocked: 0, overdue: 0 };
    teamEntry.total += 1;
    if (open) teamEntry.open += 1;
    if (t.status === "blocked" || t.status === "on_hold") teamEntry.blocked += 1;
    if (isOverdue) teamEntry.overdue += 1;
    byTeam.set(t.team_id ?? null, teamEntry);

    const assigneeEntry = byAssignee.get(t.assignee_id ?? null) ?? { total: 0, open: 0, blocked: 0, overdue: 0 };
    assigneeEntry.total += 1;
    if (open) assigneeEntry.open += 1;
    if (t.status === "blocked" || t.status === "on_hold") assigneeEntry.blocked += 1;
    if (isOverdue) assigneeEntry.overdue += 1;
    byAssignee.set(t.assignee_id ?? null, assigneeEntry);

    const projectEntry = byProject.get(t.project_id ?? null) ?? { total: 0, open: 0, blocked: 0, overdue: 0 };
    projectEntry.total += 1;
    if (open) projectEntry.open += 1;
    if (t.status === "blocked" || t.status === "on_hold") projectEntry.blocked += 1;
    if (isOverdue) projectEntry.overdue += 1;
    byProject.set(t.project_id ?? null, projectEntry);
  }

  const blockedDetails: BlockedTask[] = blockedTasks.map((t) => {
    const latest = latestComments.get(t.id);
    return {
      ...formatTaskSummary(t, maps, latest),
      description_snippet: compactText(t.description),
      latest_comment_snippet: latest ? compactText(latest.body) : null
    };
  });

  const recentComments = Array.from(latestComments.entries())
    .map(([taskId, comment]) => {
      const task = taskById.get(taskId);
      if (!task || !comment?.body) return null;
      return {
        task_id: taskId,
        title: task.title,
        created_at: comment.created_at,
        snippet: compactText(comment.body, 220) ?? "",
        assignee: maps.assigneeName(task.assignee_id),
        team: maps.teamName(task.team_id),
        project: maps.projectName(task.project_id)
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12);

  return {
    generated_at: new Date().toISOString(),
    window: {
      recent_days: recentDays,
      recent_cutoff: recentCutoff,
      due_soon_cutoff: dueSoonIso,
      today: todayIso
    },
    counts: {
      total: tasks.length,
      open: openCount,
      closed: closedCount,
      dropped: droppedCount,
      blocked: blockedCount,
      on_hold: onHoldCount,
      overdue: overdueCount,
      due_soon: dueSoonCount,
      updated_recent: updatedRecentCount
    },
    by_status: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    by_priority: Array.from(byPriority.entries()).map(([priority, count]) => ({ priority, count })),
    by_team: Array.from(byTeam.entries()).map(([id, entry]) => ({
      id,
      name: maps.teamName(id ?? null),
      ...entry
    })),
    by_assignee: Array.from(byAssignee.entries()).map(([id, entry]) => ({
      id,
      name: maps.assigneeName(id ?? null),
      ...entry
    })),
    by_project: Array.from(byProject.entries()).map(([id, entry]) => ({
      id,
      name: maps.projectName(id ?? null),
      ...entry
    })),
    tasks: detailTasks.map((t) => formatTaskSummary(t, maps, latestComments.get(t.id) ?? null)),
    blocked_tasks: blockedDetails,
    recent_comments: recentComments,
    truncated
  };
}

export function packInsightsForPrompt(insights: TaskInsights): string {
  const payload = JSON.stringify(insights);
  if (payload.length <= MAX_PROMPT_CHARS) return payload;
  return `${payload.slice(0, MAX_PROMPT_CHARS)}…(truncated)`;
}
