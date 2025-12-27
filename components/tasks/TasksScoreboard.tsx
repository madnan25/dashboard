"use client";

import { useEffect, useMemo, useState } from "react";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import type { Profile, Project, Task, TaskFlowInstance, TaskFlowTemplate, TaskPointsLedgerEntry } from "@/lib/dashboardDb";
import { listTaskFlowInstancesByTaskIds, listTaskFlowTemplates, listTaskPointsLedger, listTasksByIds } from "@/lib/dashboardDb";
import { isoDate, startOfWeek } from "@/components/tasks/taskModel";

type Mode = "impact" | "reliability" | "project";

function fmtPoints(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function parsePoints(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeRole(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

function dayDiff(aIso: string, bIso: string) {
  // a-b in days (date strings yyyy-mm-dd)
  const a = new Date(aIso + "T00:00:00Z").getTime();
  const b = new Date(bIso + "T00:00:00Z").getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

export function TasksScoreboard(props: {
  profiles: Profile[];
  projects: Project[];
  initialWeekStart?: string;
}) {
  const { profiles, projects } = props;
  const [mode, setMode] = useState<Mode>("impact");

  const [weekStart, setWeekStart] = useState(() => props.initialWeekStart ?? isoDate(startOfWeek(new Date())));
  const [projectId, setProjectId] = useState<string>(""); // optional filter
  const [templateId, setTemplateId] = useState<string>(""); // optional filter
  const [contributorId, setContributorId] = useState<string>(""); // optional filter

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [templates, setTemplates] = useState<TaskFlowTemplate[]>([]);
  const [ledger, setLedger] = useState<TaskPointsLedgerEntry[]>([]);
  const [tasksById, setTasksById] = useState<Record<string, Task>>({});
  const [flowByTaskId, setFlowByTaskId] = useState<Record<string, TaskFlowInstance>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setStatus("");
      try {
        const rows = await listTaskPointsLedger({ weekStart });
        if (cancelled) return;
        setLedger(rows);

        const ids = Array.from(new Set(rows.map((r) => r.task_id)));
        const [tasks, flows, tpls] = await Promise.all([
          listTasksByIds(ids),
          listTaskFlowInstancesByTaskIds(ids),
          listTaskFlowTemplates()
        ]);
        if (cancelled) return;
        const map: Record<string, Task> = {};
        for (const t of tasks) map[t.id] = t;
        setTasksById(map);

        const flowMap: Record<string, TaskFlowInstance> = {};
        for (const f of flows) flowMap[f.task_id] = f;
        setFlowByTaskId(flowMap);

        setTemplates(tpls);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load scoreboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const filteredLedger = useMemo(() => {
    return ledger.filter((r) => {
      if (projectId && (tasksById[r.task_id]?.project_id ?? "") !== projectId) return false;
      if (templateId) {
        const tId = flowByTaskId[r.task_id]?.template_id ?? "";
        if (tId !== templateId) return false;
      }
      if (contributorId && r.user_id !== contributorId) return false;
      return true;
    });
  }, [contributorId, flowByTaskId, ledger, projectId, tasksById, templateId]);

  const nameFor = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || id.slice(0, 8) + "…";
  };

  const impactRows = useMemo(() => {
    const byUser = new Map<string, { userId: string; points: number; tickets: number; primary: number }>();
    for (const r of filteredLedger) {
      const entry = byUser.get(r.user_id) ?? { userId: r.user_id, points: 0, tickets: 0, primary: 0 };
      const pts = parsePoints(r.points_awarded);
      entry.points += pts;
      entry.tickets += 1;
      const role = safeRole((r.breakdown as any)?.contribution_role);
      if (role === "primary") entry.primary += pts;
      byUser.set(r.user_id, entry);
    }
    return Array.from(byUser.values()).sort((a, b) => b.points - a.points);
  }, [filteredLedger]);

  const reliabilityRows = useMemo(() => {
    const byUser = new Map<
      string,
      { userId: string; primaryTickets: number; early: number; onTime: number; late: number; noDue: number }
    >();
    for (const r of filteredLedger) {
      const role = safeRole((r.breakdown as any)?.contribution_role);
      if (role !== "primary") continue;
      const t = tasksById[r.task_id];
      if (!t) continue;
      const entry =
        byUser.get(r.user_id) ?? { userId: r.user_id, primaryTickets: 0, early: 0, onTime: 0, late: 0, noDue: 0 };
      entry.primaryTickets += 1;

      if (!t.due_at || !t.approved_at) {
        entry.noDue += 1;
        byUser.set(r.user_id, entry);
        continue;
      }

      const approvedDate = t.approved_at.slice(0, 10);
      const diff = dayDiff(approvedDate, t.due_at);
      if (diff <= -1) entry.early += 1;
      else if (diff === 0) entry.onTime += 1;
      else entry.late += 1;
      byUser.set(r.user_id, entry);
    }
    return Array.from(byUser.values()).sort((a, b) => b.primaryTickets - a.primaryTickets);
  }, [filteredLedger, tasksById]);

  const projectRows = useMemo(() => {
    const byProject = new Map<string, { projectId: string; points: number; tickets: number }>();
    for (const r of filteredLedger) {
      const t = tasksById[r.task_id];
      const pid = t?.project_id ?? "";
      const key = pid || "__none__";
      const entry = byProject.get(key) ?? { projectId: pid, points: 0, tickets: 0 };
      entry.points += parsePoints(r.points_awarded);
      entry.tickets += 1;
      byProject.set(key, entry);
    }
    return Array.from(byProject.values()).sort((a, b) => b.points - a.points);
  }, [filteredLedger, tasksById]);

  const weekLabel = useMemo(() => {
    const d = new Date(weekStart + "T00:00:00Z");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }, [weekStart]);

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Scoreboard</div>
          <div className="mt-1 text-xs text-white/55">Points award once at approval. Impact over busyness.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PillSelect value={mode} onChange={(v) => setMode(v as Mode)} ariaLabel="Scoreboard view">
            <option className="bg-zinc-900" value="impact">
              Impact
            </option>
            <option className="bg-zinc-900" value="reliability">
              Reliability
            </option>
            <option className="bg-zinc-900" value="project">
              Projects
            </option>
          </PillSelect>

          <PillSelect value={projectId} onChange={setProjectId} ariaLabel="Project filter">
            <option className="bg-zinc-900" value="">
              All projects
            </option>
            {projects.map((p) => (
              <option key={p.id} className="bg-zinc-900" value={p.id}>
                {p.name}
              </option>
            ))}
          </PillSelect>

          <PillSelect value={templateId} onChange={setTemplateId} ariaLabel="Flow template filter">
            <option className="bg-zinc-900" value="">
              All templates
            </option>
            {templates.map((t) => (
              <option key={t.id} className="bg-zinc-900" value={t.id}>
                {t.name}
              </option>
            ))}
          </PillSelect>

          <PillSelect value={contributorId} onChange={setContributorId} ariaLabel="Contributor filter">
            <option className="bg-zinc-900" value="">
              All contributors
            </option>
            {profiles.map((p) => (
              <option key={p.id} className="bg-zinc-900" value={p.id}>
                {p.full_name || p.email || p.id}
              </option>
            ))}
          </PillSelect>

          <AppButton
            intent="secondary"
            size="sm"
            className="h-10 px-4"
            onPress={() => {
              const d = new Date(weekStart + "T00:00:00Z");
              d.setDate(d.getDate() - 7);
              setWeekStart(isoDate(d));
            }}
          >
            ← Prev
          </AppButton>
          <div className="text-xs text-white/65 tabular-nums px-1">{weekLabel}</div>
          <AppButton
            intent="secondary"
            size="sm"
            className="h-10 px-4"
            onPress={() => {
              const d = new Date(weekStart + "T00:00:00Z");
              d.setDate(d.getDate() + 7);
              setWeekStart(isoDate(d));
            }}
          >
            Next →
          </AppButton>
        </div>
      </div>

      {status ? <div className="mt-3 text-sm text-amber-200/90">{status}</div> : null}
      {loading ? <div className="mt-3 text-sm text-white/60">Loading…</div> : null}

      <div className="mt-4">
        {mode === "impact" ? (
          <div className="space-y-2">
            {impactRows.length === 0 ? <div className="text-sm text-white/60">No points yet for this week.</div> : null}
            {impactRows.map((r, idx) => (
              <div key={r.userId} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">
                      {idx + 1}. {nameFor(r.userId)}
                    </div>
                    <div className="mt-1 text-xs text-white/55">
                      Tickets credited: {r.tickets} · Primary impact: {fmtPoints(r.primary)}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-white/90 tabular-nums">{fmtPoints(r.points)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {mode === "reliability" ? (
          <div className="space-y-2">
            {reliabilityRows.length === 0 ? (
              <div className="text-sm text-white/60">No primary approvals yet for this week.</div>
            ) : null}
            {reliabilityRows.map((r) => {
              const denom = Math.max(1, r.primaryTickets - r.noDue);
              const onTimePct = ((r.onTime + r.early) / denom) * 100;
              return (
                <div key={r.userId} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[220px]">
                      <div className="text-sm font-semibold text-white/90">{nameFor(r.userId)}</div>
                      <div className="mt-1 text-xs text-white/55">
                        Primary tickets: {r.primaryTickets} · No due date: {r.noDue}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 tabular-nums">
                      <div>
                        On-time: <span className="text-white/90">{onTimePct.toFixed(0)}%</span>
                      </div>
                      <div>
                        Early: <span className="text-white/90">{r.early}</span>
                      </div>
                      <div>
                        On day: <span className="text-white/90">{r.onTime}</span>
                      </div>
                      <div>
                        Late: <span className="text-white/90">{r.late}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {mode === "project" ? (
          <div className="space-y-2">
            {projectRows.length === 0 ? <div className="text-sm text-white/60">No project points yet for this week.</div> : null}
            {projectRows.map((r) => {
              const name = r.projectId ? projects.find((p) => p.id === r.projectId)?.name ?? "Unknown" : "Unassigned";
              return (
                <div key={r.projectId || "__none__"} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/90">{name}</div>
                      <div className="mt-1 text-xs text-white/55">Tickets credited: {r.tickets}</div>
                    </div>
                    <div className="text-lg font-semibold text-white/90 tabular-nums">{fmtPoints(r.points)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

