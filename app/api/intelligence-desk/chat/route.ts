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

    const scopedTasks = taskIds.length > 0 ? await repo.listTasksByIds(taskIds).catch(() => [] as Task[]) : [];
    const deepDetails = await Promise.all(
      scopedTasks.map(async (t) => {
        const [comments, subtasks, deps, parentLink] = await Promise.all([
          repo.listTaskComments(t.id).catch(() => []),
          repo.listTaskSubtasks(t.id).catch(() => []),
          repo.listTaskDependencies(t.id).catch(() => [] as Array<{ id: string; blocker_task_id: string; reason: string | null }>),
          repo.getLinkedParentSubtask(t.id).catch(() => null)
        ]);
        const subtaskDeps = await Promise.all(
          subtasks.map(async (s) => ({ id: s.id, deps: await repo.listSubtaskDependencies(s.id).catch(() => []) }))
        );
        const linkedParentDeps = parentLink ? await repo.listSubtaskDependencies(parentLink.id).catch(() => []) : [];
        const recentComments = comments.slice(-2).map((c) => c.body);
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_at: t.due_at,
          subtasks: subtasks.map((s) => ({ id: s.id, title: s.title, status: s.status, due_at: s.due_at })),
          dependencies: deps,
          subtask_dependencies: subtaskDeps,
          linked_parent_subtask: parentLink
            ? {
                id: parentLink.id,
                task_id: parentLink.task_id,
                title: parentLink.title,
                status: parentLink.status
              }
            : null,
          linked_parent_dependencies: linkedParentDeps,
          recent_comments: recentComments
        };
      })
    );

    scopeContext = `${scopeContext}\n\nDEEP DIVE (live, scoped):\n${JSON.stringify({ scope: { type: scopeType, id: scopeId }, tasks: deepDetails })}`;
  }

  const messages = [
    { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
    { role: "user" as const, content: `DATA PACK (JSON):\n${dataPack}` },
    ...(scopeContext ? [{ role: "user" as const, content: scopeContext }] : []),
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
