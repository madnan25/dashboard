"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { Surface } from "@/components/ds/Surface";
import { listTaskEvents, updateTask, createTask } from "@/lib/dashboardDb";
import type { Profile, Project, Task, TaskApprovalState, TaskPriority, TaskStatus, TaskEvent } from "@/lib/dashboardDb";
import { PRIMARY_FLOW, SIDE_LANE, approvalLabel, priorityLabel, statusLabel } from "@/components/tasks/taskModel";

type Mode = { kind: "edit"; task: Task } | { kind: "create"; defaults?: Partial<Task> };

function toOptionLabel(p: Profile) {
  return p.full_name || p.email || p.id;
}

export function TaskDrawer({
  open,
  onClose,
  mode,
  profiles,
  projects,
  isCmo,
  canEdit,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  profiles: Profile[];
  projects: Project[];
  isCmo: boolean;
  canEdit: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const isCreate = mode.kind === "create";
  const task = mode.kind === "edit" ? mode.task : null;

  const [status, setStatus] = useState<string>("");
  const [events, setEvents] = useState<TaskEvent[] | null>(null);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>((task?.priority as TaskPriority) ?? "p2");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? "queued");
  const [approvalState, setApprovalState] = useState<TaskApprovalState>(
    (task?.approval_state as TaskApprovalState) ?? "pending"
  );
  const [assigneeId, setAssigneeId] = useState<string>(task?.assignee_id ?? "");
  const [projectId, setProjectId] = useState<string>(task?.project_id ?? "");
  const [dueAt, setDueAt] = useState<string>(task?.due_at ?? "");

  useEffect(() => {
    if (!open) return;
    if (mode.kind === "edit") {
      setTitle(mode.task.title);
      setDescription(mode.task.description ?? "");
      setPriority(mode.task.priority);
      setTaskStatus(mode.task.status);
      setApprovalState(mode.task.approval_state);
      setAssigneeId(mode.task.assignee_id ?? "");
      setProjectId(mode.task.project_id ?? "");
      setDueAt(mode.task.due_at ?? "");
    } else {
      const d = mode.defaults ?? {};
      setTitle((d.title as string) ?? "");
      setDescription((d.description as string) ?? "");
      setPriority((d.priority as TaskPriority) ?? "p2");
      setTaskStatus((d.status as TaskStatus) ?? "queued");
      setApprovalState((d.approval_state as TaskApprovalState) ?? "pending");
      setAssigneeId((d.assignee_id as string) ?? "");
      setProjectId((d.project_id as string) ?? "");
      setDueAt((d.due_at as string) ?? "");
    }
    setStatus("");
    setEvents(null);
  }, [mode, open]);

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      if (!open) return;
      if (mode.kind !== "edit") return;
      try {
        const rows = await listTaskEvents(mode.task.id);
        if (cancelled) return;
        setEvents(rows);
      } catch {
        if (cancelled) return;
        setEvents([]);
      }
    }
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [mode, open]);

  const assignee = useMemo(() => profiles.find((p) => p.id === assigneeId) ?? null, [assigneeId, profiles]);
  const project = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projectId, projects]);

  if (!open) return null;

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
      if (isCreate) {
        await createTask({
          title: trimmed,
          description: description.trim() ? description.trim() : null,
          priority,
          status: taskStatus,
          approval_state: approvalState,
          assignee_id: assigneeId || null,
          project_id: projectId || null,
          due_at: dueAt || null
        });
      } else if (task) {
        await updateTask(task.id, {
          title: trimmed,
          description: description.trim() ? description.trim() : null,
          priority,
          status: taskStatus,
          approval_state: approvalState,
          assignee_id: assigneeId || null,
          project_id: projectId || null,
          due_at: dueAt || null
        });
      }
      setStatus("Saved.");
      await onSaved();
      onClose();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save.");
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 md:bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-[520px] p-3 md:p-4">
        <Surface
          className="max-h-[86vh] md:max-h-[calc(100vh-32px)] overflow-auto border border-white/15 bg-white/[0.03]"
          style={{
            boxShadow: "0 30px 90px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)"
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-white/90">{isCreate ? "New task" : "Task"}</div>
              <div className="mt-1 text-xs text-white/55">
                {isCreate ? "Create a card and put it on the belt." : "Update status, owner, and approval stamp."}
              </div>
              {assignee ? (
                <div className="mt-2 text-xs text-white/50">
                  With: <span className="text-white/75">{toOptionLabel(assignee)}</span>
                  {project ? <span className="text-white/40"> · {project.name}</span> : null}
                </div>
              ) : null}
            </div>
            <AppButton intent="secondary" onPress={onClose} className="h-10 px-4 whitespace-nowrap">
              Close
            </AppButton>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Title</div>
              <AppInput value={title} onValueChange={setTitle} placeholder="e.g. V3 Reel – Construction Speed" isDisabled={!canEdit} />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Description (optional)</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
                rows={3}
                className="mt-2 w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                placeholder="No long explanations. Just enough context."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/45">Priority</div>
                <PillSelect
                  value={priority}
                  onChange={(v) => setPriority(v as TaskPriority)}
                  ariaLabel="Priority"
                  disabled={!canEdit}
                  className="mt-2"
                >
                  {(["p0", "p1", "p2", "p3"] as TaskPriority[]).map((p) => (
                    <option key={p} value={p} className="bg-zinc-900">
                      {priorityLabel(p)}
                    </option>
                  ))}
                </PillSelect>
              </div>

              <div>
                <div className="text-xs uppercase tracking-widest text-white/45">Status</div>
                <PillSelect
                  value={taskStatus}
                  onChange={(v) => setTaskStatus(v as TaskStatus)}
                  ariaLabel="Status"
                  disabled={!canEdit}
                  className="mt-2"
                >
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
                <PillSelect
                  value={assigneeId}
                  onChange={setAssigneeId}
                  ariaLabel="Assignee"
                  disabled={!canEdit}
                  className="mt-2"
                >
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
                <PillSelect
                  value={projectId}
                  onChange={setProjectId}
                  ariaLabel="Project"
                  disabled={!canEdit}
                  className="mt-2"
                >
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
                <PillSelect
                  value={approvalState}
                  onChange={(v) => setApprovalState(v as TaskApprovalState)}
                  ariaLabel="Approval"
                  disabled={!canEdit}
                  className="mt-2"
                >
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
                <AppInput
                  type="date"
                  value={dueAt}
                  onValueChange={setDueAt}
                  isDisabled={!canEdit}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/60">{status || " "}</div>
              <AppButton intent="primary" className="h-11 px-6" onPress={onSave} isDisabled={!canEdit}>
                {isCreate ? "Create task" : "Save changes"}
              </AppButton>
            </div>

            {!isCreate ? (
              <div className="pt-2">
                <div className="text-xs uppercase tracking-widest text-white/45">Activity</div>
                <div className="mt-2 space-y-2">
                  {(events ?? []).length === 0 ? (
                    <div className="text-sm text-white/45">No activity yet.</div>
                  ) : (
                    (events ?? []).map((e) => {
                      const who = profiles.find((p) => p.id === e.actor_id)?.full_name || profiles.find((p) => p.id === e.actor_id)?.email || "Someone";
                      const when = new Date(e.created_at).toLocaleString();
                      const from = e.from_value ? ` ${e.from_value} →` : "";
                      const to = e.to_value ? ` ${e.to_value}` : "";
                      return (
                        <div key={e.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                          <div className="text-sm text-white/80">
                            <span className="font-semibold text-white/90">{who}</span> ·{" "}
                            <span className="text-white/50">{when}</span>
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
              </div>
            ) : null}
          </div>
        </Surface>
      </div>
    </div>
  );
}

