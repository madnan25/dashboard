"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { TasksScoreboard } from "@/components/tasks/TasksScoreboard";
import type { Profile, Project, Task, TaskTeam } from "@/lib/dashboardDb";
import { createTask, getCurrentProfile, listProfiles, listProjects, listTasks, listTaskTeams, updateTask } from "@/lib/dashboardDb";
import { endOfWeek, isoDate, startOfWeek, taskIsOpen } from "@/components/tasks/taskModel";
import type { TaskStatus } from "@/lib/dashboardDb";
import Link from "next/link";

type View = "board" | "with_me" | "blocked" | "delivery" | "impact" | "reliability" | "project";

function labelForView(v: View) {
  switch (v) {
    case "board":
      return "Board";
    case "with_me":
      return "Approvals";
    case "blocked":
      return "Blocked P0/P1";
    case "delivery":
      return "Delivery this week";
    case "impact":
      return "Scoreboard: Impact";
    case "reliability":
      return "Scoreboard: Reliability";
    case "project":
      return "Scoreboard: Projects";
  }
}

export function TasksPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<TaskTeam[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [view, setView] = useState<View>("board");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(""); // ""=all, else user id, "__me__" handled
  const [priorityFilter, setPriorityFilter] = useState<string>(""); // ""=all
  const [projectFilter, setProjectFilter] = useState<string>(""); // ""=all
  const [teamFilter, setTeamFilter] = useState<string>(""); // ""=all

  const [newTitle, setNewTitle] = useState("");
  const [newTeamId, setNewTeamId] = useState("");
  const [creating, setCreating] = useState(false);

  const isCmo = profile?.role === "cmo";
  const canEdit = profile != null;
  const assignableProfiles = useMemo(() => profiles, [profiles]);

  function getAssigneeFilterOptionProfiles(selected: string) {
    if (!selected || selected === "__me__" || selected === "__none__") return assignableProfiles;
    if (assignableProfiles.some((p) => p.id === selected)) return assignableProfiles;
    const current = profiles.find((p) => p.id === selected) ?? null;
    return current ? [current, ...assignableProfiles] : assignableProfiles;
  }

  async function refresh() {
    try {
      setStatus("");
      const [rows, teamRows] = await Promise.all([listTasks(), listTaskTeams()]);
      setTasks(rows);
      setTeams(teamRows);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load tasks");
    }
  }

  async function onQuickCreate() {
    const t = newTitle.trim();
    if (!t) return;
    if (!canEdit) return;
    if (!newTeamId) {
      setStatus("Select a team before creating a task.");
      return;
    }
    setCreating(true);
    setStatus("");
    try {
      const created = await createTask({ title: t, team_id: newTeamId });
      setNewTitle("");
      setNewTeamId("");
      router.push(`/tasks/${created.id}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setStatus("");
        const [me, ps, projs, ts, teamRows] = await Promise.all([
          getCurrentProfile(),
          listProfiles(),
          listProjects(),
          listTasks(),
          listTaskTeams()
        ]);
        if (cancelled) return;
        setProfile(me);
        setProfiles(ps);
        setProjects(projs);
        setTeams(teamRows);
        setTasks(ts);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load tasks");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const meId = profile?.id ?? null;
  const assigneeMode = useMemo<"all" | "me" | "unassigned" | "user">(() => {
    if (!assigneeFilter) return "all";
    if (assigneeFilter === "__me__") return "me";
    if (assigneeFilter === "__none__") return "unassigned";
    return "user";
  }, [assigneeFilter]);

  const resolvedAssigneeId = useMemo(() => {
    if (assigneeMode === "me") return meId;
    if (assigneeMode === "user") return assigneeFilter;
    return null;
  }, [assigneeFilter, assigneeMode, meId]);

  const filtered = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const weekStartIso = isoDate(weekStart);
    const weekEndIso = isoDate(weekEnd);

    return tasks.filter((t) => {
      if (assigneeMode === "unassigned" && t.assignee_id) return false;
      if (resolvedAssigneeId && t.assignee_id !== resolvedAssigneeId) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (projectFilter && (t.project_id ?? "") !== projectFilter) return false;
      if (teamFilter && (t.team_id ?? "") !== teamFilter) return false;

      if (view === "with_me") {
        return t.approval_state === "pending" && taskIsOpen(t) && meId != null && t.approver_user_id === meId;
      }
      if (view === "blocked") {
        return t.status === "blocked" && (t.priority === "p0" || t.priority === "p1");
      }
      if (view === "delivery") {
        if (!taskIsOpen(t)) return false;
        if (!t.due_at) return false;
        return t.due_at >= weekStartIso && t.due_at <= weekEndIso;
      }
      if (view === "impact" || view === "reliability" || view === "project") {
        // scoreboard views don't use task list filtering here
        return true;
      }
      return true;
    });
  }, [assigneeMode, priorityFilter, projectFilter, resolvedAssigneeId, tasks, teamFilter, view, meId]);

  const viewOptions: View[] = isCmo ? ["board", "with_me", "blocked", "delivery", "impact", "reliability", "project"] : ["board", "with_me", "blocked", "delivery"];

  function canMoveToStatus(t: Task, next: TaskStatus): { ok: boolean; reason?: string } {
    if (!canEdit) return { ok: false, reason: "You can’t edit tickets" };
    const isApprover = profile?.id != null && t.approver_user_id != null && t.approver_user_id === profile.id;
    if (isCmo || isApprover) return { ok: true };

    // Non-approvers: can move only within early workflow and into holds
    const allowed: TaskStatus[] = ["queued", "in_progress", "submitted", "blocked", "on_hold"];
    const terminalForNonManagers: TaskStatus[] = ["submitted", "blocked", "on_hold"];
    if (!allowed.includes(next)) return { ok: false, reason: "Only approvers can move to that stage" };
    if (terminalForNonManagers.includes(t.status) && next !== t.status) return { ok: false, reason: "Only approvers can move tickets after this stage" };
    return { ok: true };
  }

  async function onMoveTask(t: Task, next: TaskStatus) {
    const chk = canMoveToStatus(t, next);
    if (!chk.ok) {
      setStatus(chk.reason || "Move not allowed");
      return;
    }
    const patch: Parameters<typeof updateTask>[1] = { status: next };
    if (t.approval_state !== "not_required") {
      // If you can move a ticket into Approved, you can also approve it.
      if (next === "approved") patch.approval_state = "approved";
      if (t.status === "approved" && next !== "approved") patch.approval_state = "pending";
    }

    const prev = tasks;
    setTasks((cur) =>
      cur.map((x) =>
        x.id === t.id
          ? {
              ...x,
              status: patch.status ?? x.status,
              approval_state: patch.approval_state ?? x.approval_state,
              updated_at: new Date().toISOString()
            }
          : x
      )
    );
    try {
      await updateTask(t.id, patch);
      setStatus("");
    } catch (e) {
      setTasks(prev);
      setStatus(e instanceof Error ? e.message : "Failed to move ticket");
    }
  }

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Tasks"
          subtitle="Request routing by team. One card, one owner, one approval."
          showBack
          backHref="/"
          right={
            <div className="hidden md:flex items-center gap-2">
              {isCmo ? (
                <Link href="/tasks/templates" className="text-xs text-white/70 underline">
                  Teams
                </Link>
              ) : null}
              <PillSelect value={view} onChange={(v) => setView(v as View)} ariaLabel="View">
                {viewOptions.map((v) => (
                  <option key={v} value={v} className="bg-zinc-900">
                    {labelForView(v)}
                  </option>
                ))}
              </PillSelect>
            </div>
          }
        />

        {/* Mobile controls */}
        <div className="md:hidden">
          <Surface>
            <div className="flex flex-wrap items-center gap-2">
              {isCmo ? (
                <Link href="/tasks/templates" className="text-xs text-white/70 underline">
                  Teams
                </Link>
              ) : null}
              <PillSelect value={view} onChange={(v) => setView(v as View)} ariaLabel="View">
                {viewOptions.map((v) => (
                  <option key={v} value={v} className="bg-zinc-900">
                    {labelForView(v)}
                  </option>
                ))}
              </PillSelect>
            </div>
          </Surface>
        </div>

        {view === "impact" || view === "reliability" || view === "project" ? (
          <TasksScoreboard profiles={profiles} projects={projects} />
        ) : (
          <Surface>
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs uppercase tracking-widest text-white/45">New task</div>
              <div className="text-xs text-white/45">Create then open the ticket to manage it.</div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex-1">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  disabled={!canEdit || creating}
                  placeholder="e.g. V3 Reel – Construction Speed"
                  className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                />
              </div>
              <div className="w-full md:w-64">
                <PillSelect value={newTeamId} onChange={setNewTeamId} ariaLabel="Team" disabled={!canEdit || creating}>
                  <option value="" className="bg-zinc-900">
                    Select team…
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id} className="bg-zinc-900">
                      {team.name}
                    </option>
                  ))}
                </PillSelect>
              </div>
              <AppButton
                intent="primary"
                className="h-11 px-6"
                onPress={onQuickCreate}
                isDisabled={!canEdit || creating || !newTitle.trim() || !newTeamId}
              >
                {creating ? "Creating…" : "Create task"}
              </AppButton>
            </div>
            {teams.length === 0 ? (
              <div className="mt-2 text-xs text-white/45">No teams configured yet. Ask the CMO to set up teams.</div>
            ) : null}

            <div className="my-5 h-px bg-white/10" />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-white/60">{status || " "}</div>
              <div className="flex flex-wrap items-center gap-2">
                <PillSelect value={assigneeFilter} onChange={setAssigneeFilter} ariaLabel="Assignee filter">
                  <option value="" className="bg-zinc-900">
                    All assignees
                  </option>
                  {profile ? (
                    <option value="__me__" className="bg-zinc-900">
                      Me
                    </option>
                  ) : null}
                  <option value="__none__" className="bg-zinc-900">
                    Unassigned
                  </option>
                  {getAssigneeFilterOptionProfiles(assigneeFilter).map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {p.full_name || p.email || p.id}
                    </option>
                  ))}
                </PillSelect>

                <PillSelect value={priorityFilter} onChange={setPriorityFilter} ariaLabel="Priority filter">
                  <option value="" className="bg-zinc-900">
                    All priorities
                  </option>
                  {(["p0", "p1", "p2", "p3"] as const).map((p) => (
                    <option key={p} value={p} className="bg-zinc-900">
                      {p.toUpperCase()}
                    </option>
                  ))}
                </PillSelect>

                <PillSelect value={projectFilter} onChange={setProjectFilter} ariaLabel="Project filter">
                  <option value="" className="bg-zinc-900">
                    All projects
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {p.name}
                    </option>
                  ))}
                </PillSelect>

                <PillSelect value={teamFilter} onChange={setTeamFilter} ariaLabel="Team filter">
                  <option value="" className="bg-zinc-900">
                    All teams
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id} className="bg-zinc-900">
                      {team.name}
                    </option>
                  ))}
                </PillSelect>

                <AppButton intent="secondary" className="h-10 px-4" onPress={refresh}>
                  Refresh
                </AppButton>
              </div>
            </div>

            <KanbanBoard
              tasks={filtered}
              profiles={profiles}
              projects={projects}
              teams={teams}
              onOpenTask={(t) => {
                router.push(`/tasks/${t.id}`);
              }}
              canMoveToStatus={canMoveToStatus}
              onMoveTask={onMoveTask}
            />
          </Surface>
        )}
      </div>
    </main>
  );
}

