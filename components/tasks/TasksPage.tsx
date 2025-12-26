"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import type { Profile, Project, Task } from "@/lib/dashboardDb";
import { getCurrentProfile, listProfiles, listProjects, listTasks } from "@/lib/dashboardDb";
import { endOfWeek, isoDate, startOfWeek, taskIsOpen } from "@/components/tasks/taskModel";

type View = "board" | "with_me" | "blocked" | "delivery";

function labelForView(v: View) {
  switch (v) {
    case "board":
      return "Board";
    case "with_me":
      return "With me";
    case "blocked":
      return "Blocked P0/P1";
    case "delivery":
      return "Delivery this week";
  }
}

export function TasksPage() {
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [view, setView] = useState<View>("board");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(""); // ""=all, else user id, "__me__" handled
  const [priorityFilter, setPriorityFilter] = useState<string>(""); // ""=all
  const [projectFilter, setProjectFilter] = useState<string>(""); // ""=all

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<{ kind: "create"; defaults?: Partial<Task> } | { kind: "edit"; task: Task }>({
    kind: "create"
  });

  const isCmo = profile?.role === "cmo";
  const canEdit = profile?.role != null && profile.role !== "viewer";

  async function refresh() {
    try {
      setStatus("");
      const rows = await listTasks();
      setTasks(rows);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load tasks");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setStatus("");
        const [me, ps, projs, ts] = await Promise.all([getCurrentProfile(), listProfiles(), listProjects(), listTasks()]);
        if (cancelled) return;
        setProfile(me);
        setProfiles(ps);
        setProjects(projs);
        setTasks(ts);
        if (me && me.role !== "cmo") setAssigneeFilter("__me__");
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

      if (view === "with_me") {
        // CMO control view: what needs approval
        return t.approval_state === "pending" && taskIsOpen(t);
      }
      if (view === "blocked") {
        return t.status === "blocked" && (t.priority === "p0" || t.priority === "p1");
      }
      if (view === "delivery") {
        if (!taskIsOpen(t)) return false;
        if (!t.due_at) return false;
        return t.due_at >= weekStartIso && t.due_at <= weekEndIso;
      }
      return true;
    });
  }, [assigneeMode, priorityFilter, projectFilter, resolvedAssigneeId, tasks, view]);

  const viewOptions: View[] = isCmo ? ["board", "with_me", "blocked", "delivery"] : ["board", "blocked", "delivery"];

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Tasks"
          subtitle="A control surface for execution. One card, one owner, one state."
          showBack
          backHref="/"
          right={
            <div className="hidden md:flex items-center gap-2">
              <PillSelect value={view} onChange={(v) => setView(v as View)} ariaLabel="View">
                {viewOptions.map((v) => (
                  <option key={v} value={v} className="bg-zinc-900">
                    {labelForView(v)}
                  </option>
                ))}
              </PillSelect>
              {canEdit ? (
                <AppButton
                  intent="primary"
                  className="h-10 px-4"
                  onPress={() => {
                    setDrawerMode({ kind: "create" });
                    setDrawerOpen(true);
                  }}
                >
                  New task
                </AppButton>
              ) : null}
            </div>
          }
        />

        {/* Mobile controls */}
        <div className="md:hidden">
          <Surface>
            <div className="flex flex-wrap items-center gap-2">
              <PillSelect value={view} onChange={(v) => setView(v as View)} ariaLabel="View">
                {viewOptions.map((v) => (
                  <option key={v} value={v} className="bg-zinc-900">
                    {labelForView(v)}
                  </option>
                ))}
              </PillSelect>
              {canEdit ? (
                <AppButton
                  intent="primary"
                  className="h-10 px-4"
                  onPress={() => {
                    setDrawerMode({ kind: "create" });
                    setDrawerOpen(true);
                  }}
                >
                  New task
                </AppButton>
              ) : null}
            </div>
          </Surface>
        </div>

        <Surface>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-white/60">{status || " "}</div>
            <div className="flex flex-wrap items-center gap-2">
              <PillSelect
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                ariaLabel="Assignee filter"
              >
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
                {profiles.map((p) => (
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

              <AppButton intent="secondary" className="h-10 px-4" onPress={refresh}>
                Refresh
              </AppButton>
            </div>
          </div>

          {/* Normalize special assignee filters */}
          <KanbanBoard
            tasks={filtered}
            profiles={profiles}
            projects={projects}
            onOpenTask={(t) => {
              setDrawerMode({ kind: "edit", task: t });
              setDrawerOpen(true);
            }}
          />
        </Surface>

        <TaskDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          mode={drawerMode}
          profiles={profiles}
          projects={projects}
          isCmo={!!isCmo}
          canEdit={!!canEdit}
          onSaved={refresh}
        />
      </div>
    </main>
  );
}

