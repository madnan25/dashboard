import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createDashboardRepo } from "@/lib/db/repo";
import type { Task } from "@/lib/db/types";
import { runOpenAIChat } from "@/lib/intelligence/openaiClient";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

async function requireCmo() {
  const supabase = await createSupabaseServerClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) return { error: json(401, { error: "Not authenticated" }) };

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (profileErr) return { error: json(500, { error: "Failed to verify role" }) };
  if (!profile || profile.role !== "cmo") return { error: json(403, { error: "CMO only" }) };

  return { supabase };
}

const CHAT_SYSTEM_PROMPT = [
  "You are Intelligence Desk, an executive operations assistant.",
  "Answer questions using only the provided data pack.",
  "If data is not available, say you do not have it.",
  "Be concise and actionable."
].join(" ");

const DEEP_DIVE_LIMITS = {
  tasks: 8,
  subtasks: 6,
  deps: 8,
  subtaskDeps: 4,
  comments: 3,
  events: 5,
  chain: 10,
  text: 180,
  reason: 120
};

function compactText(value: string | null | undefined, max = DEEP_DIVE_LIMITS.text) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function nameOrFallback(value: string | null | undefined, fallback: string) {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed : fallback;
}

function collectUniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

function formatDependencyLabel(
  opts: { reason?: string | null; blockerTaskId?: string | null; blockerSubtaskId?: string | null },
  taskTitleById: Map<string, string>,
  subtaskTitleById: Map<string, string>
) {
  const reason = compactText(opts.reason, DEEP_DIVE_LIMITS.reason);
  if (reason) return reason;
  if (opts.blockerTaskId) return taskTitleById.get(opts.blockerTaskId) || `${opts.blockerTaskId.slice(0, 8)}...`;
  if (opts.blockerSubtaskId) return subtaskTitleById.get(opts.blockerSubtaskId) || `${opts.blockerSubtaskId.slice(0, 8)}...`;
  return "unknown";
}

function formatEventValue(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") return compactText(value, 80);
  return compactText(String(value), 80);
}

export async function POST(req: Request) {
  const auth = await requireCmo();
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as
    | null
    | {
        question?: unknown;
        history?: Array<{ role?: unknown; content?: unknown }>;
        scope?: { type?: unknown; id?: unknown; deep?: unknown };
      };
  if (!body) return json(400, { error: "Invalid JSON body" });

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return json(400, { error: "Question is required" });

  const history = Array.isArray(body.history) ? body.history : [];
  const sanitizedHistory = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).trim() }))
    .filter((m) => m.content.length > 0)
    .slice(-10);

  const { data: report, error: reportErr } = await auth.supabase
    .from("intelligence_reports")
    .select("data_pack, insights_json, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportErr) return json(500, { error: "Failed to load cached snapshot" });
  if (!report?.data_pack) return json(404, { error: "No cached snapshot yet. Run refresh or wait for the scheduled sync." });

  const dataPack = report.data_pack as string;
  const cachedInsights = report.insights_json as
    | null
    | {
        tasks?: Array<{
          id: string;
          title: string;
          status: string;
          priority: string;
          assignee: string;
          team: string;
          project: string;
          due_at: string | null;
          updated_at: string;
          dependency_summary?: Array<{ type: "task" | "subtask"; id: string; label: string; reason: string | null }>;
          subtask_summary?: {
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
        }>;
        by_team?: Array<{ id: string | null; name: string }>;
        by_project?: Array<{ id: string | null; name: string }>;
      };

  const scope = body.scope ?? null;
  const scopeType = typeof scope?.type === "string" ? scope?.type : null;
  const scopeId = typeof scope?.id === "string" ? scope?.id.trim() : "";
  const deepDive = Boolean(scope?.deep);

  let scopeContext = "";
  if (scopeType && scopeId && cachedInsights?.tasks?.length) {
    const tasks = cachedInsights.tasks;
    let scoped: typeof tasks = [];
    if (scopeType === "task") scoped = tasks.filter((t) => t.id === scopeId);
    if (scopeType === "team") scoped = tasks.filter((t) => t.team === scopeId);
    if (scopeType === "project") scoped = tasks.filter((t) => t.project === scopeId);
    if (scopeType === "assignee") scoped = tasks.filter((t) => t.assignee === scopeId);
    const trimmed = scoped.slice(0, 12);
    scopeContext = `SCOPED CONTEXT (cached):\n${JSON.stringify({ scope: { type: scopeType, id: scopeId }, tasks: trimmed })}`;
  }

  if (deepDive && scopeType && scopeId) {
    // Best-effort deep dive: pull targeted live context for the scoped set.
    const repo = createDashboardRepo(auth.supabase);
    let taskIds: string[] = [];
    if (scopeType === "task") taskIds = [scopeId];
    if ((scopeType === "team" || scopeType === "project" || scopeType === "assignee") && cachedInsights?.tasks?.length) {
      const filtered = cachedInsights.tasks
        .filter((t) => {
          if (scopeType === "team") return t.team === scopeId;
          if (scopeType === "project") return t.project === scopeId;
          if (scopeType === "assignee") return t.assignee === scopeId;
          return false;
        })
        .slice(0, 8);
      taskIds = filtered.map((t) => t.id);
    }

    taskIds = taskIds.slice(0, DEEP_DIVE_LIMITS.tasks);
    const scopedTasks = taskIds.length > 0 ? await repo.listTasksByIds(taskIds).catch(() => [] as Task[]) : [];
    const rawDetails = await Promise.all(
      scopedTasks.slice(0, DEEP_DIVE_LIMITS.tasks).map(async (t) => {
        const [comments, subtasks, deps, parentLink, events] = await Promise.all([
          repo.listTaskComments(t.id).catch(() => []),
          repo.listTaskSubtasks(t.id).catch(() => []),
          repo.listTaskDependencies(t.id).catch(() => []),
          repo.getLinkedParentSubtask(t.id).catch(() => null),
          repo.listTaskEvents(t.id).catch(() => [])
        ]);
        const limitedSubtasks = subtasks.slice(-DEEP_DIVE_LIMITS.subtasks);
        const subtaskDeps = await Promise.all(
          limitedSubtasks.map(async (s) => ({ id: s.id, deps: await repo.listSubtaskDependencies(s.id).catch(() => []) }))
        );
        const linkedParentDeps = parentLink ? await repo.listSubtaskDependencies(parentLink.id).catch(() => []) : [];
        return {
          task: t,
          comments,
          subtasks: limitedSubtasks,
          deps,
          parentLink,
          subtaskDeps,
          linkedParentDeps,
          events
        };
      })
    );

    const blockerTaskIds = collectUniqueIds(
      rawDetails.flatMap((d) => [
        ...d.deps.map((dep) => dep.blocker_task_id),
        ...d.subtaskDeps.flatMap((row) => row.deps.map((dep) => dep.blocker_task_id)),
        ...d.linkedParentDeps.map((dep) => dep.blocker_task_id)
      ])
    ).slice(0, DEEP_DIVE_LIMITS.tasks * DEEP_DIVE_LIMITS.deps);
    const blockerTasks =
      blockerTaskIds.length > 0 ? await repo.listTasksByIds(blockerTaskIds).catch(() => [] as Task[]) : [];
    const taskTitleById = new Map(
      blockerTasks.map((t) => [t.id, nameOrFallback(t.title, `${t.id.slice(0, 8)}...`)])
    );

    const subtaskTitleById = new Map<string, string>();
    for (const entry of rawDetails) {
      for (const s of entry.subtasks) {
        subtaskTitleById.set(s.id, nameOrFallback(s.title, `${s.id.slice(0, 8)}...`));
      }
      if (entry.parentLink) {
        subtaskTitleById.set(
          entry.parentLink.id,
          nameOrFallback(entry.parentLink.title, `${entry.parentLink.id.slice(0, 8)}...`)
        );
      }
    }

    const profileIds = collectUniqueIds(
      rawDetails.flatMap((d) => [
        d.task.assignee_id,
        d.parentLink?.assignee_id,
        ...d.subtasks.map((s) => s.assignee_id),
        ...d.comments.map((c) => c.author_id),
        ...d.events.map((e) => e.actor_id)
      ])
    );
    const profiles =
      profileIds.length > 0 ? await repo.listProfilesByIds(profileIds).catch(() => []) : [];
    const profileNameById = new Map(
      profiles.map((p) => [
        p.id,
        nameOrFallback(p.full_name || p.email, `${p.id.slice(0, 8)}...`)
      ])
    );
    const resolveProfileName = (id: string | null | undefined, fallback = "Unassigned") => {
      if (!id) return fallback;
      return profileNameById.get(id) || `${id.slice(0, 8)}...`;
    };

    const deepDetails = rawDetails.map((entry) => {
      const taskLabel = nameOrFallback(entry.task.title, `${entry.task.id.slice(0, 8)}...`);
      const dependencyItems = entry.deps.slice(0, DEEP_DIVE_LIMITS.deps).map((d) => {
        const reason = compactText(d.reason, DEEP_DIVE_LIMITS.reason);
        return {
          type: "task" as const,
          id: d.blocker_task_id,
          label: formatDependencyLabel({ reason: d.reason, blockerTaskId: d.blocker_task_id }, taskTitleById, subtaskTitleById),
          ...(reason ? { reason } : {})
        };
      });

      const subtaskDependencies = entry.subtaskDeps
        .map((row) => {
          const subtaskTitle = subtaskTitleById.get(row.id) || `${row.id.slice(0, 8)}...`;
          const blockers = row.deps.slice(0, DEEP_DIVE_LIMITS.subtaskDeps).map((d) => {
            const reason = compactText(d.reason, DEEP_DIVE_LIMITS.reason);
            const id = d.blocker_task_id ?? d.blocker_subtask_id ?? "";
            return {
              type: d.blocker_task_id ? "task" : "subtask",
              id,
              label: formatDependencyLabel(
                { reason: d.reason, blockerTaskId: d.blocker_task_id, blockerSubtaskId: d.blocker_subtask_id },
                taskTitleById,
                subtaskTitleById
              ),
              ...(reason ? { reason } : {})
            };
          });
          return { subtask_id: row.id, subtask_title: subtaskTitle, blockers };
        })
        .filter((row) => row.blockers.length > 0);

      const linkedParentDependencies = entry.linkedParentDeps.slice(0, DEEP_DIVE_LIMITS.subtaskDeps).map((d) => {
        const reason = compactText(d.reason, DEEP_DIVE_LIMITS.reason);
        const id = d.blocker_task_id ?? d.blocker_subtask_id ?? "";
        return {
          type: d.blocker_task_id ? "task" : "subtask",
          id,
          label: formatDependencyLabel(
            { reason: d.reason, blockerTaskId: d.blocker_task_id, blockerSubtaskId: d.blocker_subtask_id },
            taskTitleById,
            subtaskTitleById
          ),
          ...(reason ? { reason } : {})
        };
      });

      const dependencyChain: Array<{ blocked: string; blocker: string; reason?: string | null }> = [];
      for (const item of dependencyItems) {
        dependencyChain.push({ blocked: taskLabel, blocker: item.label, ...(item.reason ? { reason: item.reason } : {}) });
      }
      for (const row of subtaskDependencies) {
        for (const blocker of row.blockers) {
          dependencyChain.push({
            blocked: `Subtask: ${row.subtask_title}`,
            blocker: blocker.label,
            ...(blocker.reason ? { reason: blocker.reason } : {})
          });
        }
      }
      if (entry.parentLink) {
        const parentTitle = subtaskTitleById.get(entry.parentLink.id) || `${entry.parentLink.id.slice(0, 8)}...`;
        for (const blocker of linkedParentDependencies) {
          dependencyChain.push({
            blocked: `Linked subtask: ${parentTitle}`,
            blocker: blocker.label,
            ...(blocker.reason ? { reason: blocker.reason } : {})
          });
        }
      }

      const recentComments = entry.comments
        .slice(-DEEP_DIVE_LIMITS.comments)
        .map((c) => ({
          at: c.created_at,
          author: resolveProfileName(c.author_id, "Unknown"),
          body: compactText(c.body, DEEP_DIVE_LIMITS.text)
        }))
        .filter((c) => Boolean(c.body));

      const recentEvents = entry.events.slice(0, DEEP_DIVE_LIMITS.events).map((e) => {
        const from = formatEventValue(e.from_value);
        const to = formatEventValue(e.to_value);
        return {
          at: e.created_at,
          type: e.type,
          actor: resolveProfileName(e.actor_id, "Unknown"),
          ...(from ? { from } : {}),
          ...(to ? { to } : {})
        };
      });

      return {
        id: entry.task.id,
        title: entry.task.title,
        status: entry.task.status,
        priority: entry.task.priority,
        assignee: resolveProfileName(entry.task.assignee_id, "Unassigned"),
        due_at: entry.task.due_at,
        dependencies: dependencyItems,
        dependency_chain: dependencyChain.slice(0, DEEP_DIVE_LIMITS.chain),
        subtasks: entry.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          assignee: resolveProfileName(s.assignee_id, "Unassigned"),
          due_at: s.due_at
        })),
        subtask_dependencies: subtaskDependencies,
        linked_parent_subtask: entry.parentLink
          ? {
              id: entry.parentLink.id,
              task_id: entry.parentLink.task_id,
              title: entry.parentLink.title,
              status: entry.parentLink.status,
              assignee: resolveProfileName(entry.parentLink.assignee_id, "Unassigned")
            }
          : null,
        linked_parent_dependencies: linkedParentDependencies,
        recent_comments: recentComments,
        recent_events: recentEvents
      };
    });

    scopeContext = `${scopeContext}\n\nDEEP DIVE (live, scoped):\n${JSON.stringify({ scope: { type: scopeType, id: scopeId }, tasks: deepDetails })}`;
  }

  const deepDiveGuidance = deepDive
    ? [
        "DEEP DIVE GUIDANCE:",
        "- Use the live scoped context first, then the cached data pack.",
        "- Explain blockers using dependency_chain, subtask_dependencies, and linked_parent_dependencies.",
        "- Use recent_events and recent_comments for what changed and who owns it.",
        "- If asked who owns a subtask, use the subtask assignee.",
        "- Answer in short, clear bullets (2-5)."
      ].join("\n")
    : "";

  const messages = [
    { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
    { role: "user" as const, content: `DATA PACK (JSON):\n${dataPack}` },
    ...(scopeContext ? [{ role: "user" as const, content: scopeContext }] : []),
    ...(deepDiveGuidance ? [{ role: "user" as const, content: deepDiveGuidance }] : []),
    ...sanitizedHistory,
    { role: "user" as const, content: question }
  ];

  try {
    const maxTokens = Number(process.env.OPENAI_MAX_TOKENS_CHAT || 700) || 700;
    const premiumModel = process.env.OPENAI_MODEL_PREMIUM || undefined;
    const reply = await runOpenAIChat({
      messages,
      temperature: 0.2,
      maxTokens,
      model: deepDive && premiumModel ? premiumModel : undefined
    });
    return json(200, {
      reply: reply.content,
      generated_at: new Date().toISOString(),
      model: reply.model
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Failed to answer question" });
  }
}
