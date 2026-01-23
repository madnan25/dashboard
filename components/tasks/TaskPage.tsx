"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { DayDatePicker } from "@/components/ds/DayDatePicker";
import type {
  Profile,
  Project,
  Task,
  TaskApprovalState,
  TaskComment,
  TaskEvent,
  TaskPointsLedgerEntry,
  TaskPriority,
  TaskStatus,
  TaskSubtask,
  TaskTeam
} from "@/lib/dashboardDb";
import {
  createTaskSubtask,
  deleteTask,
  deleteTaskSubtask,
  deleteTaskComment,
  createTaskComment,
  getCurrentProfile,
  getTask,
  listProfiles,
  listProjects,
  listTaskComments,
  listTaskEvents,
  listTaskPointsLedgerByTaskId,
  listTaskTeams,
  listTaskSubtasks,
  updateTask,
  updateTaskComment,
  updateTaskSubtask
} from "@/lib/dashboardDb";
import {
  PRIMARY_FLOW,
  SIDE_LANE,
  approvalLabel,
  isMarketingManagerProfile,
  isMarketingTeamProfile,
  priorityLabel,
  statusLabel
} from "@/components/tasks/taskModel";

function toOptionLabel(p: Profile) {
  return p.full_name || p.email || p.id;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof (err as { message?: unknown }).message === "string") return (err as { message?: string }).message || fallback;
  return fallback;
}

export function TaskPage({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<TaskTeam[]>([]);

  const [task, setTaskState] = useState<Task | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [ledger, setLedger] = useState<TaskPointsLedgerEntry[]>([]);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<string>("");
  const [loadingTask, setLoadingTask] = useState(true);

  const isCmo = profile?.role === "cmo";
  const isCreator = profile?.id != null && task?.created_by != null && task.created_by === profile.id;
  const isManager = isMarketingManagerProfile(profile) || isCmo;
  const canEditDetails = isCreator;
  const canEditAttributes = isCreator || isManager;
  const canEditTask = canEditDetails || canEditAttributes;
  const canComment = profile != null;
  const canModerateComments = isManager;
  const canDelete = isCmo;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("p2");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("queued");
  const [approvalState, setApprovalState] = useState<TaskApprovalState>("pending");
  const [teamId, setTeamId] = useState<string>("");
  const [approverUserId, setApproverUserId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>("");
  const [commentBody, setCommentBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string>("");
  const [editingBody, setEditingBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const lastSavedRef = useRef<{
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    approval_state: TaskApprovalState;
    team_id: string | null;
    assignee_id: string | null;
    project_id: string | null;
    due_at: string | null;
  } | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveSeqRef = useRef(0);

  const assignee = useMemo(() => profiles.find((p) => p.id === (assigneeId || null)) ?? null, [assigneeId, profiles]);
  const project = useMemo(() => projects.find((p) => p.id === (projectId || null)) ?? null, [projectId, projects]);
  const assignableProfiles = useMemo(() => profiles.filter(isMarketingTeamProfile), [profiles]);
  const team = useMemo(() => teams.find((t) => t.id === teamId) ?? null, [teamId, teams]);
  const approverProfile = useMemo(() => profiles.find((p) => p.id === approverUserId) ?? null, [approverUserId, profiles]);
  const approverLabel = useMemo(() => {
    if (!approverUserId) return "—";
    return approverProfile ? toOptionLabel(approverProfile) : `${approverUserId.slice(0, 8)}…`;
  }, [approverProfile, approverUserId]);
  const isApprover = profile?.id != null && approverUserId != null && approverUserId === profile.id;
  const canApprove = isCmo || isApprover;
  const primaryContributor = useMemo(() => {
    const primaryId = assigneeId || task?.created_by || "";
    if (!primaryId) return null;
    return profiles.find((p) => p.id === primaryId) ?? null;
  }, [assigneeId, profiles, task?.created_by]);
  const secondaryContributors = useMemo(() => {
    const primaryId = assigneeId || task?.created_by || "";
    const ids = new Set<string>();
    for (const s of subtasks) {
      if (s.assignee_id && s.assignee_id !== primaryId && s.status !== "dropped") {
        ids.add(s.assignee_id);
      }
    }
    return Array.from(ids)
      .map((id) => profiles.find((p) => p.id === id) ?? null)
      .filter((p): p is Profile => Boolean(p));
  }, [assigneeId, profiles, subtasks, task?.created_by]);
  function getAssigneeOptionProfiles(selectedId: string | null) {
    if (!selectedId) return assignableProfiles;
    if (assignableProfiles.some((p) => p.id === selectedId)) return assignableProfiles;
    const current = profiles.find((p) => p.id === selectedId) ?? null;
    return current ? [current, ...assignableProfiles] : assignableProfiles;
  }

  const refresh = useCallback(async () => {
    setLoadingTask(true);
    try {
      setStatus("");
      setCommentsStatus("");
      const [t, ev, led, subs, teamRows] = await Promise.all([
        getTask(taskId),
        listTaskEvents(taskId),
        listTaskPointsLedgerByTaskId(taskId),
        listTaskSubtasks(taskId),
        listTaskTeams()
      ]);
      setTaskState(t);
      setEvents(ev);
      setLedger(led);
      setSubtasks(subs);
      setTeams(teamRows);
      try {
        const commentRows = await listTaskComments(taskId);
        setComments(commentRows);
      } catch (e) {
        setComments([]);
        setCommentsStatus(getErrorMessage(e, "Comments unavailable."));
      }
      if (t) {
        setTitle(t.title ?? "");
        setDescription(t.description ?? "");
        setPriority(t.priority);
        setTaskStatus(t.status);
        setApprovalState(t.approval_state);
        setTeamId(t.team_id ?? "");
        setApproverUserId(t.approver_user_id ?? "");
        setAssigneeId(t.assignee_id ?? "");
        setProjectId(t.project_id ?? "");
        setDueAt(t.due_at ?? "");

        lastSavedRef.current = {
          title: t.title ?? "",
          description: t.description ?? null,
          priority: t.priority,
          status: t.status,
          approval_state: t.approval_state,
          team_id: t.team_id ?? null,
          assignee_id: t.assignee_id ?? null,
          project_id: t.project_id ?? null,
          due_at: t.due_at ?? null
        };
      }
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to load task"));
    } finally {
      setLoadingTask(false);
    }
  }, [taskId]);

  async function refreshSubtasksOnly() {
    const subs = await listTaskSubtasks(taskId);
    setSubtasks(subs);
  }

  async function refreshCommentsOnly() {
    try {
      setCommentsStatus("");
      const rows = await listTaskComments(taskId);
      setComments(rows);
    } catch (e) {
      setComments([]);
      setCommentsStatus(getErrorMessage(e, "Failed to load comments"));
    }
  }

  async function onCreateComment() {
    if (!canComment) return;
    const body = commentBody.trim();
    if (!body) return;
    setSavingComment(true);
    setStatus("Posting comment…");
    try {
      setCommentsStatus("");
      const created = await createTaskComment({ task_id: taskId, body });
      setCommentBody("");
      setComments((prev) => [...prev, created]);
      setStatus("Comment added.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to add comment"));
      await refreshCommentsOnly().catch(() => null);
    } finally {
      setSavingComment(false);
    }
  }

  function onEditComment(comment: TaskComment) {
    if (!canModerateComments) return;
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
  }

  function onCancelEditComment() {
    setEditingCommentId("");
    setEditingBody("");
  }

  async function onSaveCommentEdit(id: string) {
    if (!canModerateComments) return;
    const body = editingBody.trim();
    if (!body) return;
    setSavingComment(true);
    setStatus("Saving comment…");
    try {
      setCommentsStatus("");
      await updateTaskComment(id, { body });
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, body } : c)));
      setEditingCommentId("");
      setEditingBody("");
      setStatus("Comment updated.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to update comment"));
      await refreshCommentsOnly().catch(() => null);
    } finally {
      setSavingComment(false);
    }
  }

  async function onDeleteComment(id: string) {
    if (!canModerateComments) return;
    if (!confirm("Delete this comment?")) return;
    setSavingComment(true);
    setStatus("Deleting comment…");
    try {
      setCommentsStatus("");
      await deleteTaskComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setStatus("Comment deleted.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to delete comment"));
      await refreshCommentsOnly().catch(() => null);
    } finally {
      setSavingComment(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const [me, ps, projs, teamRows] = await Promise.all([getCurrentProfile(), listProfiles(), listProjects(), listTaskTeams()]);
        if (cancelled) return;
        setProfile(me);
        setProfiles(ps);
        setProjects(projs);
        setTeams(teamRows);
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
  }, [refresh]);

  useEffect(() => {
    if (!teamId) {
      if (approverUserId) setApproverUserId("");
      return;
    }
    const team = teams.find((t) => t.id === teamId) ?? null;
    if (!team) return;
    if (team.approver_user_id !== approverUserId) {
      setApproverUserId(team.approver_user_id ?? "");
    }
  }, [approverUserId, teamId, teams]);

  useEffect(() => {
    if (!canEditTask) return;
    if (loadingTask) return;
    if (!task) return;
    if (!lastSavedRef.current) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      // Don't persist invalid state; allow user to keep typing.
      return;
    }

    const next = {
      title: trimmedTitle,
      description: description.trim() ? description.trim() : null,
      priority,
      status: taskStatus,
      approval_state: approvalState,
      team_id: teamId || null,
      assignee_id: assigneeId || null,
      project_id: projectId || null,
      due_at: dueAt || null
    };

    const prev = lastSavedRef.current;
    const changed =
      next.title !== prev.title ||
      next.description !== prev.description ||
      next.priority !== prev.priority ||
      next.status !== prev.status ||
      next.approval_state !== prev.approval_state ||
      next.team_id !== prev.team_id ||
      next.assignee_id !== prev.assignee_id ||
      next.project_id !== prev.project_id ||
      next.due_at !== prev.due_at;
    if (!changed) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const seq = ++autosaveSeqRef.current;
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setStatus("Saving…");
        await updateTask(taskId, next);
        if (autosaveSeqRef.current !== seq) return; // superseded
        lastSavedRef.current = next;
        setTaskState((t) => (t ? { ...t, ...next, assignee_id: next.assignee_id, project_id: next.project_id, due_at: next.due_at } : t));
        setStatus("Saved.");
      } catch (e) {
        if (autosaveSeqRef.current !== seq) return;
        setStatus(e instanceof Error ? e.message : "Failed to save");
      }
    }, 650);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [
    approvalState,
    assigneeId,
    canEditTask,
    description,
    dueAt,
    loadingTask,
    priority,
    projectId,
    refresh,
    task,
    taskId,
    taskStatus,
    title,
    teamId
  ]);

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

  async function onCreateSubtask() {
    if (!canEditAttributes) return;
    const t = newSubtaskTitle.trim();
    if (!t) return;
    setStatus("Creating subtask…");
    try {
      const created = await createTaskSubtask({ task_id: taskId, title: t });
      setNewSubtaskTitle("");
      setStatus("Subtask created.");
      setSubtasks((prev) => [...prev, created]);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create subtask");
    }
  }

  async function onUpdateSubtask(id: string, patch: Partial<Pick<TaskSubtask, "title" | "status" | "assignee_id" | "due_at" | "effort_points">>) {
    if (!canEditAttributes) return;
    setStatus("Saving subtask…");
    const snapshot = subtasks;
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      await updateTaskSubtask(id, patch);
      setStatus("Subtask saved.");
    } catch (e) {
      setSubtasks(snapshot);
      await refreshSubtasksOnly().catch(() => null);
      setStatus(e instanceof Error ? e.message : "Failed to save subtask");
    }
  }

  async function onRemoveSubtask(id: string) {
    if (!canEditAttributes) return;
    if (!confirm("Delete this subtask?")) return;
    setStatus("Deleting subtask…");
    const snapshot = subtasks;
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteTaskSubtask(id);
      setStatus("Subtask deleted.");
    } catch (e) {
      setSubtasks(snapshot);
      await refreshSubtasksOnly().catch(() => null);
      setStatus(e instanceof Error ? e.message : "Failed to delete subtask");
    }
  }

  async function onApproveTask() {
    if (!canComment || !task) return;
    if (approvalState !== "pending") return;
    if (!canApprove) {
      setStatus("Only the assigned approver can approve this ticket.");
      return;
    }
    setStatus("Approving…");
    try {
      setApprovalState("approved");
      setTaskStatus("approved");
      await updateTask(taskId, { approval_state: "approved", status: "approved" });
      setStatus("Approved.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to approve");
    }
  }

  async function onSetStatus(next: TaskStatus) {
    if (!canEditAttributes) return;
    const prevStatus = taskStatus;
    const prevApproval = approvalState;
    setTaskStatus(next);
    try {
      setStatus("Saving…");
      const patch: Parameters<typeof updateTask>[1] = { status: next };
      if (approvalState !== "not_required") {
        if (next === "approved" && canApprove) {
          setApprovalState("approved");
          patch.approval_state = "approved";
        }
        // Only reset approval when moving back to pre-approval stages.
        if (next === "queued" || next === "in_progress" || next === "submitted") {
          setApprovalState("pending");
          patch.approval_state = "pending";
        }
      }
      await updateTask(taskId, patch);
      lastSavedRef.current = lastSavedRef.current ? { ...lastSavedRef.current, status: next, approval_state: patch.approval_state ?? lastSavedRef.current.approval_state } : lastSavedRef.current;
      setTaskState((t) => (t ? { ...t, status: next, approval_state: patch.approval_state ?? t.approval_state } : t));
      setStatus("Saved.");
    } catch (e) {
      setTaskStatus(prevStatus);
      setApprovalState(prevApproval);
      setStatus(e instanceof Error ? e.message : "Failed to update status");
      await refresh().catch(() => null);
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
        />

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        {loadingTask ? (
          <div className="grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-7">
              <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
              <div className="mt-3 h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
              <div className="mt-3 h-24 w-full rounded-2xl bg-white/5 animate-pulse" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
                <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
                <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
                <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <div className="h-11 w-28 rounded-2xl bg-white/5 animate-pulse" />
                <div className="h-11 w-36 rounded-2xl bg-white/10 animate-pulse" />
              </div>
            </Surface>
            <Surface className="md:col-span-5">
              <div className="h-5 w-24 rounded bg-white/10 animate-pulse" />
              <div className="mt-3 h-4 w-44 rounded bg-white/5 animate-pulse" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
                ))}
              </div>
            </Surface>
          </div>
        ) : !task ? (
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
                    {team ? <span className="text-white/40"> · {team.name}</span> : null}
                    </div>
                  ) : null}
                </div>
                {canDelete ? (
                  <AppButton intent="danger" className="h-10 px-4 whitespace-nowrap" onPress={onDelete}>
                    Delete
                  </AppButton>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {taskStatus !== "closed" ? (
                  <AppButton
                    intent="secondary"
                    size="sm"
                    className="h-10 px-4"
                    onPress={() => onSetStatus("in_progress")}
                    isDisabled={!canEditAttributes}
                  >
                    Start work
                  </AppButton>
                ) : null}
                <AppButton
                  intent="secondary"
                  size="sm"
                  className="h-10 px-4"
                  onPress={() => onSetStatus("submitted")}
                  isDisabled={!canEditAttributes || taskStatus === "closed" || !teamId || !approverUserId}
                >
                  Submit for approval
                </AppButton>
                  {canApprove ? (
                    taskStatus === "closed" ? (
                      <AppButton
                        intent="secondary"
                        size="sm"
                        className="h-10 px-4"
                        onPress={() => onSetStatus("in_progress")}
                        isDisabled={!canEditAttributes}
                      >
                        Reopen ticket
                      </AppButton>
                    ) : (
                      <AppButton
                        intent="primary"
                        size="sm"
                        className="h-10 px-4"
                        onPress={() => onSetStatus("closed")}
                        isDisabled={!canEditAttributes || approvalState !== "approved"}
                      >
                        Close ticket
                      </AppButton>
                    )
                  ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Title</div>
                  <AppInput value={title} onValueChange={setTitle} isDisabled={!canEditDetails} />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Description (optional)</div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEditDetails}
                    rows={4}
                    className="mt-2 w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                    placeholder="No long explanations. Just enough context."
                  />
                </div>

                {!canEditDetails ? (
                  <div className="text-xs text-white/45">Only the creator can edit the title and description.</div>
                ) : null}
                {!canEditAttributes ? (
                  <div className="text-xs text-white/45">
                    Only the creator, marketing managers, or the CMO can edit priority, status, assignments, or due dates.
                  </div>
                ) : null}
                <div className="my-2 h-px bg-white/10" />

                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Subtasks</div>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="flex-1">
                      <input
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        disabled={!canEditAttributes}
                        placeholder="Add a subtask…"
                        className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                      />
                    </div>
                    <AppButton
                      intent="secondary"
                      className="h-11 px-6"
                      onPress={onCreateSubtask}
                      isDisabled={!canEditAttributes || !newSubtaskTitle.trim()}
                    >
                      Add
                    </AppButton>
                  </div>
                  <div className="mt-3 space-y-2">
                    {subtasks.length === 0 ? <div className="text-sm text-white/50">No subtasks yet.</div> : null}
                    {subtasks.map((s) => (
                      <div key={s.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white/90">{s.title}</div>
                            <div className="mt-1 text-xs text-white/55">
                              Status: {s.status}
                              {s.due_at ? <span className="text-white/40"> · Due {s.due_at}</span> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <PillSelect
                              value={s.status}
                              onChange={(v) => onUpdateSubtask(s.id, { status: v as TaskSubtask["status"] })}
                              ariaLabel="Subtask status"
                              disabled={!canEditAttributes}
                            >
                              {[...PRIMARY_FLOW, ...SIDE_LANE].map((st) => (
                                <option key={st} value={st} className="bg-zinc-900">
                                  {statusLabel(st)}
                                </option>
                              ))}
                            </PillSelect>
                            <PillSelect
                              value={s.assignee_id ?? ""}
                              onChange={(v) => onUpdateSubtask(s.id, { assignee_id: v || null })}
                              ariaLabel="Subtask assignee"
                              disabled={!canEditAttributes}
                            >
                              <option value="" className="bg-zinc-900">
                                Unassigned
                              </option>
                              {getAssigneeOptionProfiles(s.assignee_id ?? null).map((p) => {
                                return (
                                  <option key={p.id} value={p.id} className="bg-zinc-900">
                                    {toOptionLabel(p)}
                                  </option>
                                );
                              })}
                            </PillSelect>
                            <AppButton
                              intent="danger"
                              size="sm"
                              className="h-10 px-4"
                              onPress={() => onRemoveSubtask(s.id)}
                              isDisabled={!canEditAttributes}
                            >
                              Delete
                            </AppButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <AppButton intent="secondary" className="h-11 px-6" onPress={refresh}>
                    Refresh
                  </AppButton>
                </div>
              </div>
            </Surface>

            <Surface className="md:col-span-5">
              <div className="text-lg font-semibold text-white/90">Properties</div>
              <div className="mt-1 text-sm text-white/55">Notion-style fields. {canEditAttributes ? "Editable for you." : "Read-only for you."}</div>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Priority</div>
                  {canEditAttributes ? (
                    <PillSelect value={priority} onChange={(v) => setPriority(v as TaskPriority)} ariaLabel="Priority">
                      {(["p0", "p1", "p2", "p3"] as TaskPriority[]).map((p) => (
                        <option key={p} value={p} className="bg-zinc-900">
                          {priorityLabel(p)}
                        </option>
                      ))}
                    </PillSelect>
                  ) : (
                    <div className="text-sm text-white/80">{priorityLabel(priority)}</div>
                  )}
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Status</div>
                  {canEditAttributes ? (
                    <PillSelect value={taskStatus} onChange={(v) => onSetStatus(v as TaskStatus)} ariaLabel="Status">
                      {[...PRIMARY_FLOW, ...SIDE_LANE].map((s) => (
                        <option key={s} value={s} className="bg-zinc-900">
                          {statusLabel(s)}
                        </option>
                      ))}
                    </PillSelect>
                  ) : (
                    <div className="text-sm text-white/80">{statusLabel(taskStatus)}</div>
                  )}
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Assignee</div>
                  {canEditAttributes ? (
                    <PillSelect value={assigneeId} onChange={setAssigneeId} ariaLabel="Assignee">
                      <option value="" className="bg-zinc-900">
                        Unassigned
                      </option>
                      {getAssigneeOptionProfiles(assigneeId || null).map((p) => (
                        <option key={p.id} value={p.id} className="bg-zinc-900">
                          {toOptionLabel(p)}
                        </option>
                      ))}
                    </PillSelect>
                  ) : (
                    <div className="text-sm text-white/80">{assignee ? toOptionLabel(assignee) : "Unassigned"}</div>
                  )}
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Project</div>
                  {canEditAttributes ? (
                    <PillSelect value={projectId} onChange={setProjectId} ariaLabel="Project stamp">
                      <option value="" className="bg-zinc-900">
                        None
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id} className="bg-zinc-900">
                          {p.name}
                        </option>
                      ))}
                    </PillSelect>
                  ) : (
                    <div className="text-sm text-white/80">{project ? project.name : "None"}</div>
                  )}
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Team</div>
                  {canEditAttributes ? (
                    <PillSelect value={teamId} onChange={setTeamId} ariaLabel="Team">
                      <option value="" className="bg-zinc-900">
                        Select…
                      </option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} className="bg-zinc-900">
                          {t.name}
                        </option>
                      ))}
                    </PillSelect>
                  ) : (
                    <div className="text-sm text-white/80">{team ? team.name : "—"}</div>
                  )}
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Approver</div>
                  <div className="text-sm text-white/80">{approverLabel}</div>
                </div>

                <div className="grid grid-cols-[130px,1fr] items-start gap-3">
                  <div className="pt-1 text-xs uppercase tracking-widest text-white/45">Approval</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm text-white/80">{approvalLabel(approvalState)}</div>
                      {canApprove && approvalState === "pending" ? (
                        <AppButton
                          intent="primary"
                          size="sm"
                          className="h-9 px-4"
                          onPress={onApproveTask}
                          isDisabled={!canComment || !canApprove || (!approverUserId && !isCmo) || taskStatus === "closed"}
                        >
                          Approve
                        </AppButton>
                      ) : null}
                    </div>
                    {!approverUserId && !isCmo ? (
                      <div className="mt-1 text-xs text-white/45">Blocked until a team approver is assigned.</div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Due</div>
                  {canEditAttributes ? (
                    <DayDatePicker value={dueAt} onChange={setDueAt} placeholder="Select due date" isDisabled={!canEditAttributes} showClear />
                  ) : (
                    <div className="text-sm text-white/80">{dueAt || "—"}</div>
                  )}
                </div>

                {teams.length === 0 ? <div className="text-xs text-white/45">No teams configured yet. Ask the CMO to set them up.</div> : null}
              </div>

              <div className="my-4 h-px bg-white/10" />

              <div className="text-sm font-semibold text-white/85">Contributors + points</div>
              <div className="mt-2 space-y-2 text-sm text-white/80">
                <div>
                  Primary: <span className="text-white/90">{primaryContributor ? toOptionLabel(primaryContributor) : "Unassigned"}</span>
                </div>
                <div>
                  Secondary:{" "}
                  <span className="text-white/90">
                    {secondaryContributors.length === 0 ? "None" : secondaryContributors.map((p) => toOptionLabel(p)).join(", ")}
                  </span>
                </div>
                <div>
                  Approver: <span className="text-white/90">{approverLabel}</span>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {ledger.length === 0 ? (
                  <div className="text-sm text-white/50">No points awarded yet.</div>
                ) : (
                  ledger.map((l) => {
                    const who =
                      profiles.find((p) => p.id === l.user_id)?.full_name ||
                      profiles.find((p) => p.id === l.user_id)?.email ||
                      l.user_id.slice(0, 8) + "…";
                    return (
                      <div key={l.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white/90">{who}</div>
                            <div className="mt-1 text-xs text-white/55">
                              Tier: {l.weight_tier} · Week: {l.week_start}
                            </div>
                          </div>
                          <div className="text-lg font-semibold text-white/90 tabular-nums">{l.points_awarded}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="my-4 h-px bg-white/10" />

              <div className="text-lg font-semibold text-white/90">Comments</div>
              <div className="mt-1 text-sm text-white/55">Leave context for the team.</div>
              {commentsStatus ? <div className="mt-2 text-xs text-amber-200/90">{commentsStatus}</div> : null}

              <div className="mt-4">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  disabled={!canComment || savingComment}
                  rows={3}
                  className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                  placeholder="Add a comment…"
                />
                <div className="mt-2 flex justify-end">
                  <AppButton
                    intent="primary"
                    className="h-10 px-4"
                    onPress={onCreateComment}
                    isDisabled={!canComment || savingComment || !commentBody.trim()}
                  >
                    {savingComment ? "Posting…" : "Post comment"}
                  </AppButton>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {comments.length === 0 ? (
                  <div className="text-sm text-white/45">No comments yet.</div>
                ) : (
                  comments.map((c) => {
                    const author =
                      profiles.find((p) => p.id === c.author_id)?.full_name ||
                      profiles.find((p) => p.id === c.author_id)?.email ||
                      "Someone";
                    const when = new Date(c.created_at).toLocaleString();
                    const isEditing = editingCommentId === c.id;
                    return (
                      <div key={c.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm text-white/80">
                            <span className="font-semibold text-white/90">{author}</span> · <span className="text-white/50">{when}</span>
                          </div>
                          {canModerateComments ? (
                            <div className="flex items-center gap-2">
                              {isEditing ? null : (
                                <button className="text-xs text-white/60 hover:text-white/80" onClick={() => onEditComment(c)}>
                                  Edit
                                </button>
                              )}
                              <button className="text-xs text-white/60 hover:text-white/80" onClick={() => onDeleteComment(c.id)}>
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {isEditing ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              rows={3}
                              disabled={savingComment}
                              className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 outline-none focus:border-white/20"
                            />
                            <div className="flex justify-end gap-2">
                              <AppButton intent="secondary" className="h-9 px-4" onPress={onCancelEditComment} isDisabled={savingComment}>
                                Cancel
                              </AppButton>
                              <AppButton
                                intent="primary"
                                className="h-9 px-4"
                                onPress={() => onSaveCommentEdit(c.id)}
                                isDisabled={savingComment || !editingBody.trim()}
                              >
                                Save
                              </AppButton>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{c.body}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="my-4 h-px bg-white/10" />

              <div className="text-lg font-semibold text-white/90">Activity</div>
              <div className="mt-1 text-sm text-white/55">What changed, and where it stopped.</div>

              <div className="mt-4 space-y-2">
                {events.length === 0 ? (
                  <div className="text-sm text-white/45">No activity yet.</div>
                ) : (
                  events.map((e) => {
                    const who =
                      profiles.find((p) => p.id === e.actor_id)?.full_name ||
                      profiles.find((p) => p.id === e.actor_id)?.email ||
                      "Someone";
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

