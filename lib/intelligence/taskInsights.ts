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
  dependency_summary: Array<{
    type: "task" | "subtask";
    id: string;
    label: string;
    reason: string | null;
  }>;
  subtask_summary: {
    total: number;
    not_done: number;
    done: number;
    blocked: number;
    on_hold: number;
    overdue: number;
    due_soon: number;
    blocked_by_dependencies: number;
    top_blocked: string[];
  } | null;
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
  timeZone?: string;
};

type CommentRow = {
  task_id: string;
  body: string;
  created_at: string;
};

type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  status: "not_done" | "done" | "blocked" | "on_hold";
  assignee_id: string | null;
  due_at: string | null;
  linked_task_id: string | null;
};

type TaskDependencyRow = {
  id: string;
  blocker_task_id: string;
  blocked_task_id: string;
  reason: string | null;
};

type SubtaskDependencyRow = {
  id: string;
  blocked_subtask_id: string;
  blocker_task_id: string | null;
  blocker_subtask_id: string | null;
  reason: string | null;
};

const DEFAULT_TIMEZONE = "Asia/Karachi";

function isoDateInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!year || !month || !day) return date.toISOString().slice(0, 10);
    return `${year}-${month}-${day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function addDaysIso(isoDate: string, days: number) {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isOpenStatus(status: TaskStatus) {
  return status !== "closed" && status !== "dropped";
}

function isTaskResolved(status: TaskStatus) {
  return status === "approved" || status === "closed" || status === "dropped";
}

function isSubtaskResolved(status: SubtaskRow["status"]) {
  return status === "done";
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

async function loadSubtasks(supabase: SupabaseClient, taskIds: string[]): Promise<SubtaskRow[]> {
  const unique = Array.from(new Set(taskIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("task_subtasks")
    .select("id, task_id, title, status, assignee_id, due_at, linked_task_id")
    .in("task_id", unique);
  if (error) throw error;
  return (data as SubtaskRow[]) ?? [];
}

async function loadLinkedParentSubtasks(supabase: SupabaseClient, taskIds: string[]): Promise<SubtaskRow[]> {
  const unique = Array.from(new Set(taskIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("task_subtasks")
    .select("id, task_id, title, status, assignee_id, due_at, linked_task_id")
    .in("linked_task_id", unique);
  if (error) throw error;
  return (data as SubtaskRow[]) ?? [];
}

async function loadTaskDependencies(supabase: SupabaseClient, taskIds: string[]): Promise<TaskDependencyRow[]> {
  const unique = Array.from(new Set(taskIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("id, blocker_task_id, blocked_task_id, reason")
    .in("blocked_task_id", unique);
  if (error) throw error;
  return (data as TaskDependencyRow[]) ?? [];
}

async function loadSubtaskDependencies(supabase: SupabaseClient, subtaskIds: string[]): Promise<SubtaskDependencyRow[]> {
  const unique = Array.from(new Set(subtaskIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("task_subtask_dependencies")
    .select("id, blocked_subtask_id, blocker_task_id, blocker_subtask_id, reason")
    .in("blocked_subtask_id", unique);
  if (error) throw error;
  return (data as SubtaskDependencyRow[]) ?? [];
}

function formatTaskSummary(
  t: Task,
  maps: ReturnType<typeof buildNameMaps>,
  latestComment: CommentRow | null,
  dependencySummary: TaskSummary["dependency_summary"],
  subtaskSummary: TaskSummary["subtask_summary"]
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
    latest_comment_at: latestComment?.created_at ?? null,
    dependency_summary: dependencySummary,
    subtask_summary: subtaskSummary
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
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;

  const supabase = options.supabase ?? (await createServerDbClient());
  const repo = createDashboardRepo(supabase);

  const [tasks, profiles, projects, teams] = await Promise.all([
    repo.listTasks(),
    repo.listProfiles(),
    repo.listProjects(),
    repo.listTaskTeams()
  ]);

  const today = new Date();
  const todayIso = isoDateInTimeZone(today, timeZone);
  const dueSoonIso = addDaysIso(todayIso, 7);
  const recentCutoff = addDaysIso(todayIso, -recentDays);

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
  const detailTaskIds = detailTasks.map((t) => t.id);
  const dependencyTaskIds = Array.from(new Set([...detailTaskIds, ...blockedTasks.map((t) => t.id)]));

  const [subtasks, linkedParentSubtasks] = await Promise.all([
    loadSubtasks(supabase, dependencyTaskIds),
    loadLinkedParentSubtasks(supabase, dependencyTaskIds)
  ]);
  const allSubtasks = [...subtasks, ...linkedParentSubtasks];
  const subtaskById = new Map(allSubtasks.map((s) => [s.id, s]));
  const subtasksByTaskId = new Map<string, SubtaskRow[]>();
  for (const s of subtasks) {
    const cur = subtasksByTaskId.get(s.task_id) ?? [];
    cur.push(s);
    subtasksByTaskId.set(s.task_id, cur);
  }
  const linkedParentsByTaskId = new Map<string, SubtaskRow[]>();
  for (const s of linkedParentSubtasks) {
    if (!s.linked_task_id) continue;
    const cur = linkedParentsByTaskId.get(s.linked_task_id) ?? [];
    cur.push(s);
    linkedParentsByTaskId.set(s.linked_task_id, cur);
  }

  const taskDeps = await loadTaskDependencies(supabase, dependencyTaskIds);
  const taskDepsByBlocked = new Map<string, TaskDependencyRow[]>();
  for (const d of taskDeps) {
    const cur = taskDepsByBlocked.get(d.blocked_task_id) ?? [];
    cur.push(d);
    taskDepsByBlocked.set(d.blocked_task_id, cur);
  }

  const subtaskDeps = await loadSubtaskDependencies(
    supabase,
    allSubtasks.map((s) => s.id)
  );
  const subtaskDepsByBlocked = new Map<string, SubtaskDependencyRow[]>();
  for (const d of subtaskDeps) {
    const cur = subtaskDepsByBlocked.get(d.blocked_subtask_id) ?? [];
    cur.push(d);
    subtaskDepsByBlocked.set(d.blocked_subtask_id, cur);
  }

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

  function buildDependencySummary(taskId: string) {
    const items: TaskSummary["dependency_summary"] = [];

    const deps = taskDepsByBlocked.get(taskId) ?? [];
    for (const d of deps) {
      const blocker = taskById.get(d.blocker_task_id);
      if (blocker && isTaskResolved(blocker.status)) continue;
      const label = compactText(d.reason, 80) || blocker?.title || `${d.blocker_task_id.slice(0, 8)}…`;
      items.push({ type: "task", id: d.blocker_task_id, label, reason: d.reason ?? null });
    }

    const subRows = subtasksByTaskId.get(taskId) ?? [];
    for (const s of subRows) {
      const depRows = subtaskDepsByBlocked.get(s.id) ?? [];
      for (const d of depRows) {
        if (d.blocker_task_id) {
          const blocker = taskById.get(d.blocker_task_id);
          if (blocker && isTaskResolved(blocker.status)) continue;
          const label =
            compactText(d.reason, 80) || blocker?.title || `${d.blocker_task_id.slice(0, 8)}…`;
          items.push({ type: "task", id: d.blocker_task_id, label, reason: d.reason ?? null });
        } else if (d.blocker_subtask_id) {
          const blockerSub = subtaskById.get(d.blocker_subtask_id);
          if (blockerSub && isSubtaskResolved(blockerSub.status)) continue;
          const label =
            compactText(d.reason, 80) || blockerSub?.title || `${d.blocker_subtask_id.slice(0, 8)}…`;
          items.push({ type: "subtask", id: d.blocker_subtask_id, label, reason: d.reason ?? null });
        }
      }
    }

    const linkedParents = linkedParentsByTaskId.get(taskId) ?? [];
    for (const s of linkedParents) {
      const depRows = subtaskDepsByBlocked.get(s.id) ?? [];
      for (const d of depRows) {
        if (d.blocker_task_id) {
          const blocker = taskById.get(d.blocker_task_id);
          if (blocker && isTaskResolved(blocker.status)) continue;
          const label =
            compactText(d.reason, 80) || blocker?.title || `${d.blocker_task_id.slice(0, 8)}…`;
          items.push({ type: "task", id: d.blocker_task_id, label, reason: d.reason ?? null });
        } else if (d.blocker_subtask_id) {
          const blockerSub = subtaskById.get(d.blocker_subtask_id);
          if (blockerSub && isSubtaskResolved(blockerSub.status)) continue;
          const label =
            compactText(d.reason, 80) || blockerSub?.title || `${d.blocker_subtask_id.slice(0, 8)}…`;
          items.push({ type: "subtask", id: d.blocker_subtask_id, label, reason: d.reason ?? null });
        }
      }
    }

    const seen = new Set<string>();
    return items
      .filter((i) => {
        const key = `${i.type}:${i.id.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }

  function buildSubtaskSummary(taskId: string) {
    const rows = subtasksByTaskId.get(taskId) ?? [];
    if (rows.length === 0) return null;
    let blockedByDeps = 0;
    const topBlocked: string[] = [];
    let done = 0;
    let blocked = 0;
    let onHold = 0;
    let notDone = 0;
    let overdue = 0;
    let dueSoon = 0;
    for (const s of rows) {
      if (s.status === "done") done += 1;
      if (s.status === "blocked") blocked += 1;
      if (s.status === "on_hold") onHold += 1;
      if (s.status === "not_done") notDone += 1;
      const hasDeps = (subtaskDepsByBlocked.get(s.id) ?? []).length > 0;
      if (hasDeps) blockedByDeps += 1;
      if ((s.status === "blocked" || s.status === "on_hold") && topBlocked.length < 3) {
        topBlocked.push(s.title || `${s.id.slice(0, 8)}…`);
      }
      if (s.due_at) {
        if (s.due_at < todayIso) overdue += 1;
        if (s.due_at >= todayIso && s.due_at <= dueSoonIso) dueSoon += 1;
      }
    }
    return {
      total: rows.length,
      not_done: notDone,
      done,
      blocked,
      on_hold: onHold,
      overdue,
      due_soon: dueSoon,
      blocked_by_dependencies: blockedByDeps,
      top_blocked: topBlocked
    };
  }

  const blockedDetails: BlockedTask[] = blockedTasks.map((t) => {
    const latest = latestComments.get(t.id) ?? null;
    const dependencySummary = buildDependencySummary(t.id);
    const subtaskSummary = buildSubtaskSummary(t.id);
    return {
      ...formatTaskSummary(t, maps, latest, dependencySummary, subtaskSummary),
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
    tasks: detailTasks.map((t) =>
      formatTaskSummary(
        t,
        maps,
        latestComments.get(t.id) ?? null,
        buildDependencySummary(t.id),
        buildSubtaskSummary(t.id)
      )
    ),
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
