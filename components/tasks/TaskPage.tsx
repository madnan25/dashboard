"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import type { Profile, Project, Task, TaskApprovalState, TaskEvent, TaskPriority, TaskStatus } from "@/lib/dashboardDb";
import { deleteTask, getCurrentProfile, getTask, listProfiles, listProjects, listTaskEvents, updateTask } from "@/lib/dashboardDb";
import { PRIMARY_FLOW, SIDE_LANE, approvalLabel, priorityLabel, statusLabel } from "@/components/tasks/taskModel";

function toOptionLabel(p: Profile) {
  return p.full_name || p.email || p.id;
}

export function TaskPage({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [task, setTaskState] = useState<Task | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);

  const isCmo = profile?.role === "cmo";
  const canEdit = profile?.role != null && profile.role !== "viewer";
  const canDelete = profile?.role === "cmo" || profile?.can_manage_tasks === true;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("p2");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("queued");
  const [approvalState, setApprovalState] = useState<TaskApprovalState>("pending");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");

  const assignee = useMemo(() => profiles.find((p) => p.id === (assigneeId || null)) ?? null, [assigneeId, profiles]);
  const project = useMemo(() => projects.find((p) => p.id === (projectId || null)) ?? null, [projectId, projects]);

  async function refresh() {
    try {
      setStatus("");
      const [t, ev] = await Promise.all([getTask(taskId), listTaskEvents(taskId)]);
      setTaskState(t);
      setEvents(ev);
      if (t) {
        setTitle(t.title ?? "");
        setDescription(t.description ?? "");
        setPriority(t.priority);
        setTaskStatus(t.status);
        setApprovalState(t.approval_state);
        setAssigneeId(t.assignee_id ?? "");
        setProjectId(t.project_id ?? "");
        setDueAt(t.due_at ?? "");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load task");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const [me, ps, projs] = await Promise.all([getCurrentProfile(), listProfiles(), listProjects()]);
        if (cancelled) return;
        setProfile(me);
        setProfiles(ps);
        setProjects(projs);
      } catch {
        // ignore
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refresh().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const approvalOptions: Array<{ value: TaskApprovalState; label: string; disabled?: boolean }> = [
    { value: "not_required", label: approvalLabel("not_required") },
    { value: "pending", label: approvalLabel("pending") },
    { value: "approved", label: approvalLabel("approved"), disabled: !isCmo }
  ];

  async function onSave() {
    if (!canEdit) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setStatus("Title is required.");
      return;
    }
    setStatus("Saving…");
    try {
      await updateTask(taskId, {
        title: trimmed,
        description: description.trim() ? description.trim() : null,
        priority,
        status: taskStatus,
        approval_state: approvalState,
        assignee_id: assigneeId || null,
        project_id: projectId || null,
        due_at: dueAt || null
      });
      setStatus("Saved.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function onDelete() {
    if (!canDelete) return;
    if (!confirm("Delete this task? This will permanently remove it from the system.")) return;
    setStatus("Deleting…");
    try {
      await deleteTask(taskId);
      router.push("/tasks");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader
          title="Task"
          subtitle={task ? `${task.title}` : "Loading…"}
          showBack
          backHref="/tasks"
          right={
            <div className="hidden md:flex items-center gap-2">
              <AppButton intent="secondary" className="h-10 px-4" onPress={() => router.push("/tasks")}>
                Back to board
              </AppButton>
            </div>
          }
        />

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        {!task ? (
          <Surface>
            <div className="text-sm text-white/60">Task not found.</div>
            <div className="mt-3">
              <Link className="text-sm text-white/80 underline" href="/tasks">
                Back to tasks
              </Link>
            </div>
          </Surface>
        ) : (
          <div className="grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-7">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-white/90">Ticket</div>
                  <div className="mt-1 text-xs text-white/55">One card. One owner. One state. A stamp if approved.</div>
                  {assignee ? (
                    <div className="mt-2 text-xs text-white/50">
                      With: <span className="text-white/75">{toOptionLabel(assignee)}</span>
                      {project ? <span className="text-white/40"> · {project.name}</span> : null}
                    </div>
                  ) : null}
                </div>
                {canDelete ? (
                  <AppButton intent="danger" className="h-10 px-4 whitespace-nowrap" onPress={onDelete}>
                    Delete
                  </AppButton>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Title</div>
                  <AppInput value={title} onValueChange={setTitle} isDisabled={!canEdit} />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Description (optional)</div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEdit}
                    rows={4}
                    className="mt-2 w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                    placeholder="No long explanations. Just enough context."
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Priority</div>
                    <PillSelect value={priority} onChange={(v) => setPriority(v as TaskPriority)} ariaLabel="Priority" disabled={!canEdit} className="mt-2">
                      {(["p0", "p1", "p2", "p3"] as TaskPriority[]).map((p) => (
                        <option key={p} value={p} className="bg-zinc-900">
                          {priorityLabel(p)}
                        </option>
                      ))}
                    </PillSelect>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Status</div>
                    <PillSelect value={taskStatus} onChange={(v) => setTaskStatus(v as TaskStatus)} ariaLabel="Status" disabled={!canEdit} className="mt-2">
                      {[...PRIMARY_FLOW, ...SIDE_LANE].map((s) => (
                        <option key={s} value={s} className="bg-zinc-900">
                          {statusLabel(s)}
                        </option>
                      ))}
                    </PillSelect>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Assignee</div>
                    <PillSelect value={assigneeId} onChange={setAssigneeId} ariaLabel="Assignee" disabled={!canEdit} className="mt-2">
                      <option value="" className="bg-zinc-900">
                        Unassigned
                      </option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id} className="bg-zinc-900">
                          {toOptionLabel(p)}
                        </option>
                      ))}
                    </PillSelect>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Project stamp (optional)</div>
                    <PillSelect value={projectId} onChange={setProjectId} ariaLabel="Project" disabled={!canEdit} className="mt-2">
                      <option value="" className="bg-zinc-900">
                        None
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id} className="bg-zinc-900">
                          {p.name}
                        </option>
                      ))}
                    </PillSelect>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Approval stamp</div>
                    <PillSelect value={approvalState} onChange={(v) => setApprovalState(v as TaskApprovalState)} ariaLabel="Approval" disabled={!canEdit} className="mt-2">
                      {approvalOptions.map((o) => (
                        <option key={o.value} value={o.value} className="bg-zinc-900" disabled={o.disabled}>
                          {o.label}
                        </option>
                      ))}
                    </PillSelect>
                    {!isCmo ? <div className="mt-2 text-xs text-white/45">Only CMO can stamp “Approved”.</div> : null}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Due date (optional)</div>
                    <AppInput type="date" value={dueAt} onValueChange={setDueAt} isDisabled={!canEdit} className="mt-2" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <AppButton intent="secondary" className="h-11 px-6" onPress={refresh}>
                    Refresh
                  </AppButton>
                  <AppButton intent="primary" className="h-11 px-6" onPress={onSave} isDisabled={!canEdit}>
                    Save changes
                  </AppButton>
                </div>
              </div>
            </Surface>

            <Surface className="md:col-span-5">
              <div className="text-lg font-semibold text-white/90">Activity</div>
              <div className="mt-1 text-sm text-white/55">What changed, and where it stopped.</div>

              <div className="mt-4 space-y-2">
                {events.length === 0 ? (
                  <div className="text-sm text-white/45">No activity yet.</div>
                ) : (
                  events.map((e) => {
                    const who = profiles.find((p) => p.id === e.actor_id)?.full_name || profiles.find((p) => p.id === e.actor_id)?.email || "Someone";
                    const when = new Date(e.created_at).toLocaleString();
                    const from = e.from_value ? ` ${e.from_value} →` : "";
                    const to = e.to_value ? ` ${e.to_value}` : "";
                    return (
                      <div key={e.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <div className="text-sm text-white/80">
                          <span className="font-semibold text-white/90">{who}</span> · <span className="text-white/50">{when}</span>
                        </div>
                        <div className="mt-1 text-sm text-white/70">
                          {e.type}
                          {from}
                          {to}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Surface>
          </div>
        )}
      </div>
    </main>
  );
}

