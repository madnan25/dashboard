"use client";

import { useEffect, useMemo, useState } from "react";
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
  TaskContribution,
  TaskEvent,
  TaskFlowInstance,
  TaskFlowStepInstance,
  TaskFlowTemplate,
  TaskFlowTemplateStep,
  TaskPointsLedgerEntry,
  TaskPriority,
  TaskStatus,
  TaskSubtask
} from "@/lib/dashboardDb";
import {
  approveTaskFlowStep,
  createTaskFlowInstanceFromTemplate,
  createTaskSubtask,
  deleteTask,
  deleteTaskContributionByRole,
  deleteTaskSubtask,
  getCurrentProfile,
  getTask,
  getTaskFlowInstance,
  listProfiles,
  listProjects,
  listTaskContributions,
  listTaskEvents,
  listTaskFlowStepInstances,
  listTaskFlowTemplateSteps,
  listTaskFlowTemplates,
  listTaskPointsLedgerByTaskId,
  listTaskSubtasks,
  updateTask,
  updateTaskSubtask,
  upsertTaskContributions
} from "@/lib/dashboardDb";
import { PRIMARY_FLOW, SIDE_LANE, approvalLabel, priorityLabel, statusLabel } from "@/components/tasks/taskModel";
import { isAssignableTaskRole } from "@/components/tasks/taskModel";

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
  const [ledger, setLedger] = useState<TaskPointsLedgerEntry[]>([]);
  const [contributions, setContributions] = useState<TaskContribution[]>([]);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [flowTemplates, setFlowTemplates] = useState<TaskFlowTemplate[]>([]);
  const [flowInstance, setFlowInstance] = useState<TaskFlowInstance | null>(null);
  const [flowSteps, setFlowSteps] = useState<TaskFlowStepInstance[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSteps, setTemplateSteps] = useState<TaskFlowTemplateStep[]>([]);
  const [templateApprovers, setTemplateApprovers] = useState<Record<string, string>>({}); // step_key -> user_id
  const [loadingTask, setLoadingTask] = useState(true);

  const isCmo = profile?.role === "cmo";
  const canEdit = profile?.role != null && profile.role !== "viewer";
  const canDelete = profile?.role === "cmo" || (profile?.is_marketing_team === true && profile?.is_marketing_manager === true);
  const canSeeTasks =
    profile?.role != null &&
    (profile.role === "cmo" || (profile.role !== "sales_ops" && profile.is_marketing_team === true));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("p2");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("queued");
  const [approvalState, setApprovalState] = useState<TaskApprovalState>("pending");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");
  const [primaryUserId, setPrimaryUserId] = useState<string>("");
  const [secondaryUserId, setSecondaryUserId] = useState<string>("");
  const [coordinatorUserId, setCoordinatorUserId] = useState<string>("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>("");

  const assignee = useMemo(() => profiles.find((p) => p.id === (assigneeId || null)) ?? null, [assigneeId, profiles]);
  const project = useMemo(() => projects.find((p) => p.id === (projectId || null)) ?? null, [projectId, projects]);
  const assignableProfiles = useMemo(() => profiles.filter((p) => isAssignableTaskRole(p.role)), [profiles]);

  function getAssigneeOptionProfiles(selectedId: string | null) {
    if (!selectedId) return assignableProfiles;
    if (assignableProfiles.some((p) => p.id === selectedId)) return assignableProfiles;
    const current = profiles.find((p) => p.id === selectedId) ?? null;
    return current ? [current, ...assignableProfiles] : assignableProfiles;
  }

  async function refresh() {
    setLoadingTask(true);
    try {
      setStatus("");
      const [t, ev, led, subs, contribs, inst, tpls] = await Promise.all([
        getTask(taskId),
        listTaskEvents(taskId),
        listTaskPointsLedgerByTaskId(taskId),
        listTaskSubtasks(taskId),
        listTaskContributions(taskId),
        getTaskFlowInstance(taskId),
        listTaskFlowTemplates()
      ]);
      setTaskState(t);
      setEvents(ev);
      setLedger(led);
      setSubtasks(subs);
      setContributions(contribs);
      setFlowInstance(inst);
      setFlowTemplates(tpls);
      if (inst) {
        const steps = await listTaskFlowStepInstances(inst.id);
        setFlowSteps(steps);
      } else {
        setFlowSteps([]);
      }
      if (t) {
        setTitle(t.title ?? "");
        setDescription(t.description ?? "");
        setPriority(t.priority);
        setTaskStatus(t.status);
        setApprovalState(t.approval_state);
        setAssigneeId(t.assignee_id ?? "");
        setProjectId(t.project_id ?? "");
        setDueAt(t.due_at ?? "");

        const primary = contribs.find((c) => c.role === "primary")?.user_id ?? "";
        const secondary = contribs.find((c) => c.role === "secondary")?.user_id ?? "";
        const coord = contribs.find((c) => c.role === "coordinator")?.user_id ?? "";
        setPrimaryUserId(primary || t.assignee_id || t.created_by || "");
        setSecondaryUserId(secondary);
        setCoordinatorUserId(coord || (t.created_by && t.created_by !== (t.assignee_id ?? "") ? t.created_by : ""));
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load task");
    } finally {
      setLoadingTask(false);
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
    { value: "approved", label: approvalLabel("approved"), disabled: profile?.is_marketing_manager !== true }
  ];

  const marketingManagers = useMemo(() => profiles.filter((p) => p.is_marketing_manager === true), [profiles]);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplateSteps() {
      if (!selectedTemplateId) {
        setTemplateSteps([]);
        setTemplateApprovers({});
        return;
      }
      try {
        const steps = await listTaskFlowTemplateSteps(selectedTemplateId);
        if (cancelled) return;
        setTemplateSteps(steps);
        const defaults: Record<string, string> = {};
        const fallback = marketingManagers[0]?.id || profile?.id || "";
        for (const s of steps) {
          defaults[s.step_key] = s.approver_user_id || fallback;
        }
        setTemplateApprovers(defaults);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load flow template");
      }
    }
    loadTemplateSteps();
    return () => {
      cancelled = true;
    };
  }, [marketingManagers, profile?.id, selectedTemplateId]);

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

  async function onSaveContributions() {
    if (!canEdit) return;
    if (!task) return;
    setStatus("Saving contributions…");
    try {
      const deletes: Array<"primary" | "secondary" | "coordinator"> = [];
      const upserts: Array<{ role: "primary" | "secondary" | "coordinator"; user_id: string }> = [];

      const next = {
        primary: primaryUserId.trim(),
        secondary: secondaryUserId.trim(),
        coordinator: coordinatorUserId.trim()
      };

      (["primary", "secondary", "coordinator"] as const).forEach((role) => {
        const val = next[role];
        if (!val) deletes.push(role);
        else upserts.push({ role, user_id: val });
      });

      // delete first so "clearing" a role works
      for (const role of deletes) {
        await deleteTaskContributionByRole(taskId, role);
      }
      if (upserts.length > 0) {
        await upsertTaskContributions(taskId, upserts);
      }

      setStatus("Contributions saved.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save contributions");
    }
  }

  async function onCreateSubtask() {
    if (!canEdit) return;
    const t = newSubtaskTitle.trim();
    if (!t) return;
    setStatus("Creating subtask…");
    try {
      await createTaskSubtask({ task_id: taskId, title: t });
      setNewSubtaskTitle("");
      setStatus("Subtask created.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create subtask");
    }
  }

  async function onUpdateSubtask(id: string, patch: Partial<Pick<TaskSubtask, "title" | "status" | "assignee_id" | "due_at" | "effort_points">>) {
    if (!canEdit) return;
    setStatus("Saving subtask…");
    try {
      await updateTaskSubtask(id, patch);
      setStatus("Subtask saved.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save subtask");
    }
  }

  async function onRemoveSubtask(id: string) {
    if (!canEdit) return;
    if (!confirm("Delete this subtask?")) return;
    setStatus("Deleting subtask…");
    try {
      await deleteTaskSubtask(id);
      setStatus("Subtask deleted.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to delete subtask");
    }
  }

  async function onCreateFlowFromTemplate() {
    if (!canEdit) return;
    if (!selectedTemplateId) {
      setStatus("Select a flow template first.");
      return;
    }
    if (!task) return;
    if (flowInstance) {
      setStatus("This ticket already has a flow.");
      return;
    }
    if (templateSteps.length === 0) {
      setStatus("This template has no steps.");
      return;
    }
    setStatus("Creating approval flow…");
    try {
      const resolved = templateSteps.map((s) => ({
        step_order: s.step_order,
        step_key: s.step_key,
        label: s.label,
        approver_user_id: (templateApprovers[s.step_key] || s.approver_user_id || null) as string | null
      }));
      if (resolved.some((r) => !r.approver_user_id)) {
        setStatus("Every step needs an approver.");
        return;
      }
      await createTaskFlowInstanceFromTemplate(taskId, selectedTemplateId, resolved);
      setStatus("Approval flow created.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create approval flow");
    }
  }

  async function onApproveCurrentFlowStep(stepId: string) {
    setStatus("Approving…");
    try {
      await approveTaskFlowStep(stepId);
      setStatus("Approved.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to approve");
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

        {profile && !canSeeTasks ? (
          <Surface>
            <div className="text-sm text-white/75">You don’t have access to Tasks.</div>
            <div className="mt-1 text-xs text-white/50">Ask the CMO to add you to the marketing team.</div>
          </Surface>
        ) : null}

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        {profile && !canSeeTasks ? null : loadingTask ? (
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
                      {getAssigneeOptionProfiles(assigneeId || null).map((p) => {
                        const canAssign = isAssignableTaskRole(p.role);
                        return (
                          <option key={p.id} value={p.id} className="bg-zinc-900" disabled={!canAssign}>
                            {toOptionLabel(p)}
                            {!canAssign ? " (not assignable)" : ""}
                          </option>
                        );
                      })}
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
                    {profile?.is_marketing_manager !== true ? (
                      <div className="mt-2 text-xs text-white/45">Only marketing managers can stamp “Approved”.</div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Due date (optional)</div>
                    <div className="mt-2">
                      <DayDatePicker
                        value={dueAt}
                        onChange={setDueAt}
                        placeholder="Select due date"
                        isDisabled={!canEdit}
                        showClear
                      />
                    </div>
                  </div>
                </div>

                <div className="my-2 h-px bg-white/10" />

                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Approval flow</div>
                  <div className="mt-2 text-sm text-white/60">
                    Templates define stages and approvers. Approving the terminal step stamps the ticket and awards points.
                  </div>

                  {flowInstance ? (
                    <div className="mt-3 space-y-2">
                      {flowSteps.length === 0 ? (
                        <div className="text-sm text-white/50">This ticket has a flow instance but no steps.</div>
                      ) : (
                        flowSteps.map((s) => {
                          const isCurrent = flowInstance.current_step_order === s.step_order;
                          const canApprove =
                            profile?.role === "cmo" ||
                            (profile?.id != null && s.approver_user_id != null && s.approver_user_id === profile.id);
                          return (
                            <div
                              key={s.id}
                              className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white/90">
                                    {s.step_order}. {s.label} {isCurrent ? <span className="text-white/50">(current)</span> : null}
                                  </div>
                                  <div className="mt-1 text-xs text-white/55">
                                    Approver:{" "}
                                    <span className="text-white/75">
                                      {profiles.find((p) => p.id === s.approver_user_id)?.full_name ||
                                        profiles.find((p) => p.id === s.approver_user_id)?.email ||
                                        (s.approver_user_id ? s.approver_user_id.slice(0, 8) + "…" : "—")}
                                    </span>{" "}
                                    · Status: <span className="text-white/75">{s.status}</span>
                                  </div>
                                </div>

                                {isCurrent && s.status !== "approved" ? (
                                  <AppButton
                                    intent="primary"
                                    size="sm"
                                    className="h-10 px-5 whitespace-nowrap"
                                    onPress={() => onApproveCurrentFlowStep(s.id)}
                                    isDisabled={!canEdit || !canApprove}
                                  >
                                    Approve step
                                  </AppButton>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-white/45">Template</div>
                          <PillSelect
                            value={selectedTemplateId}
                            onChange={setSelectedTemplateId}
                            ariaLabel="Flow template"
                            disabled={!canEdit}
                            className="mt-2"
                          >
                            <option value="" className="bg-zinc-900">
                              Select…
                            </option>
                            {flowTemplates.map((t) => (
                              <option key={t.id} value={t.id} className="bg-zinc-900">
                                {t.name}
                              </option>
                            ))}
                          </PillSelect>
                        </div>
                        <div className="flex items-end">
                          <AppButton
                            intent="primary"
                            className="h-11 px-6"
                            onPress={onCreateFlowFromTemplate}
                            isDisabled={!canEdit || !selectedTemplateId || templateSteps.length === 0}
                          >
                            Set flow
                          </AppButton>
                        </div>
                      </div>

                      {selectedTemplateId && templateSteps.length > 0 ? (
                        <div className="space-y-2">
                          {templateSteps.map((s) => (
                            <div
                              key={s.id}
                              className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                            >
                              <div className="text-sm font-semibold text-white/90">
                                {s.step_order}. {s.label}
                              </div>
                              <div className="mt-2">
                                <PillSelect
                                  value={templateApprovers[s.step_key] || ""}
                                  onChange={(v) => setTemplateApprovers((prev) => ({ ...prev, [s.step_key]: v }))}
                                  ariaLabel={`Approver for ${s.label}`}
                                  disabled={!canEdit}
                                >
                                  <option value="" className="bg-zinc-900">
                                    Select approver…
                                  </option>
                                  {marketingManagers.map((p) => (
                                    <option key={p.id} value={p.id} className="bg-zinc-900">
                                      {toOptionLabel(p)}
                                    </option>
                                  ))}
                                </PillSelect>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="my-2 h-px bg-white/10" />

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Contribution split</div>
                    <div className="mt-2 grid gap-2">
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="text-xs text-white/45 pt-2">Primary (65% / 90%)</div>
                        <PillSelect value={primaryUserId} onChange={setPrimaryUserId} ariaLabel="Primary contributor" disabled={!canEdit}>
                          <option value="" className="bg-zinc-900">
                            Select…
                          </option>
                          {profiles.map((p) => (
                            <option key={p.id} value={p.id} className="bg-zinc-900">
                              {toOptionLabel(p)}
                            </option>
                          ))}
                        </PillSelect>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="text-xs text-white/45 pt-2">Secondary (25%)</div>
                        <PillSelect value={secondaryUserId} onChange={setSecondaryUserId} ariaLabel="Secondary contributor" disabled={!canEdit}>
                          <option value="" className="bg-zinc-900">
                            None
                          </option>
                          {profiles.map((p) => (
                            <option key={p.id} value={p.id} className="bg-zinc-900">
                              {toOptionLabel(p)}
                            </option>
                          ))}
                        </PillSelect>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="text-xs text-white/45 pt-2">Coordinator (10%)</div>
                        <PillSelect value={coordinatorUserId} onChange={setCoordinatorUserId} ariaLabel="Coordinator" disabled={!canEdit}>
                          <option value="" className="bg-zinc-900">
                            None
                          </option>
                          {profiles.map((p) => (
                            <option key={p.id} value={p.id} className="bg-zinc-900">
                              {toOptionLabel(p)}
                            </option>
                          ))}
                        </PillSelect>
                      </div>

                      <div className="flex justify-end">
                        <AppButton intent="secondary" className="h-10 px-4" onPress={onSaveContributions} isDisabled={!canEdit}>
                          Save split
                        </AppButton>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Points (awarded on approval)</div>
                    <div className="mt-2 space-y-2">
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
                  </div>
                </div>

                <div className="my-2 h-px bg-white/10" />

                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Subtasks</div>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                    <div className="flex-1">
                      <input
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        disabled={!canEdit}
                        placeholder="Add a subtask…"
                        className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                      />
                    </div>
                    <AppButton intent="secondary" className="h-11 px-6" onPress={onCreateSubtask} isDisabled={!canEdit || !newSubtaskTitle.trim()}>
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
                              disabled={!canEdit}
                            >
                              {(["todo", "in_progress", "done", "dropped"] as const).map((st) => (
                                <option key={st} value={st} className="bg-zinc-900">
                                  {st}
                                </option>
                              ))}
                            </PillSelect>
                            <PillSelect
                              value={s.assignee_id ?? ""}
                              onChange={(v) => onUpdateSubtask(s.id, { assignee_id: v || null })}
                              ariaLabel="Subtask assignee"
                              disabled={!canEdit}
                            >
                              <option value="" className="bg-zinc-900">
                                Unassigned
                              </option>
                              {getAssigneeOptionProfiles(s.assignee_id ?? null).map((p) => {
                                const canAssign = isAssignableTaskRole(p.role);
                                return (
                                  <option key={p.id} value={p.id} className="bg-zinc-900" disabled={!canAssign}>
                                    {toOptionLabel(p)}
                                    {!canAssign ? " (not assignable)" : ""}
                                  </option>
                                );
                              })}
                            </PillSelect>
                            <AppButton intent="danger" size="sm" className="h-10 px-4" onPress={() => onRemoveSubtask(s.id)} isDisabled={!canEdit}>
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

