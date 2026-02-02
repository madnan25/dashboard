"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { DayDatePicker } from "@/components/ds/DayDatePicker";
import { DropdownItem, DropdownMenu } from "@/components/ds/DropdownMenu";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  Profile,
  Project,
  Task,
  TaskApprovalState,
  TaskAttachment,
  TaskComment,
  TaskCommentMention,
  TaskCommentAttachment,
  TaskEvent,
  TaskPriority,
  TaskStatus,
  TaskSubtask,
  TaskSubtaskDependency,
  TaskSubtaskStatus,
  TaskTeam,
  TaskMasterCalendarTag
} from "@/lib/dashboardDb";
import {
  createTaskSubtask,
  createTask,
  createTaskDependency,
  deleteTask,
  deleteTaskDependency,
  deleteTaskSubtask,
  deleteTaskComment,
  createTaskComment,
  createSubtaskDependency,
  deleteSubtaskDependency,
  getLinkedParentSubtask,
  nextTeamTicketNumber,
  getCurrentProfile,
  getTask,
  listTaskAttachments,
  createTaskAttachment,
  deleteTaskAttachment,
  listTaskCommentMentions,
  createTaskCommentMentions,
  listTaskCommentAttachments,
  createTaskCommentAttachments,
  listTaskDependencies,
  listProfiles,
  listProfilesByIds,
  listProjects,
  listTasks,
  listTasksByIds,
  listTaskComments,
  listTaskEvents,
  listTaskTeams,
  listTaskSubtasks,
  listSubtaskDependencies,
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

function formatDesignTicketTitle(number: number, label: string) {
  return `DES-${number}: ${label}`;
}

function formatBytes(size: number) {
  if (!Number.isFinite(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatProductionTicketTitle(number: number, label: string) {
  return `PROD-${number}: ${label}`;
}

function normalizeTicketPrefix(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  if (!cleaned) return null;
  if (!/^[A-Z0-9]{2,8}$/.test(cleaned)) return null;
  return cleaned;
}

function formatTicketTitle(prefix: string, number: number, label: string) {
  return `${prefix}-${number}: ${label}`;
}

const DEPENDENCY_TICKET_STATUSES: TaskStatus[] = ["queued", "in_progress", "submitted"];
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function TaskPage({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<TaskTeam[]>([]);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [task, setTaskState] = useState<Task | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [, setLedger] = useState<unknown[]>([]);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [subtaskDependencies, setSubtaskDependencies] = useState<Record<string, TaskSubtaskDependency[]>>({});
  const [subtaskDependencyAction, setSubtaskDependencyAction] = useState<Record<string, "" | "task" | "subtask">>({});
  const [subtaskDependencyPickerValue, setSubtaskDependencyPickerValue] = useState<Record<string, string>>({});
  const [dependencyTickets, setDependencyTickets] = useState<Task[]>([]);
  const [taskDependencies, setTaskDependencies] = useState<Array<{ id: string; blocker_task_id: string; reason: string | null }>>([]);
  const [taskDependencyPickerValue, setTaskDependencyPickerValue] = useState<string>("");
  const [linkedFromSubtaskDeps, setLinkedFromSubtaskDeps] = useState<TaskSubtaskDependency[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<string>("");
  const [loadingTask, setLoadingTask] = useState(true);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentsStatus, setAttachmentsStatus] = useState<string>("");
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [commentMentionsByCommentId, setCommentMentionsByCommentId] = useState<Record<string, string[]>>({});
  const [commentAttachmentsByCommentId, setCommentAttachmentsByCommentId] = useState<Record<string, string[]>>({});

  const isCmo = profile?.role === "cmo";
  const isCreator = profile?.id != null && task?.created_by != null && task.created_by === profile.id;
  const isManager = isMarketingManagerProfile(profile) || isCmo;
  const canEditDetails = isCreator || isManager;
  const canEditDescription = isCreator || Boolean(profile && isMarketingTeamProfile(profile));
  // Properties (priority/assignee/team/project/due) are creator or marketing manager/CMO.
  const canEditProperties = isCreator || isManager;
  // Status is collaborative for marketing team, but approval/close still requires assigned approver/CMO.
  const canEditStatus = Boolean(profile && isMarketingTeamProfile(profile)) || canEditProperties;
  const canEditTask = canEditDetails || canEditProperties || canEditDescription;
  const canComment = profile != null;
  const canDelete = isCmo;
  const canCreateSubtasks = profile != null; // anyone who can view the ticket can add subtasks
  const canEditSubtasks = Boolean(profile && isMarketingTeamProfile(profile)); // marketing team can manage subtasks
  function canManageSubtaskLinks(s: TaskSubtask) {
    if (!profile) return false;
    if (linkedParentSubtask?.task_id) return false;
    if (isManager) return true;
    return s.created_by != null && s.created_by === profile.id;
  }
  function canEditSubtaskTitle(s: TaskSubtask) {
    if (!profile) return false;
    if (isManager) return true;
    return s.created_by != null && s.created_by === profile.id;
  }

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
  const [masterCalendarTag, setMasterCalendarTag] = useState<TaskMasterCalendarTag | "">("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>("");
  const [commentBody, setCommentBody] = useState("");
  const [commentMentionIds, setCommentMentionIds] = useState<string[]>([]);
  const [commentAttachmentIds, setCommentAttachmentIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string>("");
  const [editingBody, setEditingBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [linkedTaskTitles, setLinkedTaskTitles] = useState<Record<string, string>>({});
  const [linkedTaskDueAt, setLinkedTaskDueAt] = useState<Record<string, string | null>>({});
  const [linkedTaskStatus, setLinkedTaskStatus] = useState<Record<string, TaskStatus | null>>({});
  const [subtaskLinkAction, setSubtaskLinkAction] = useState<Record<string, "" | "existing" | "design" | "production">>({});
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, { description?: string; title?: string }>>({});
  const [editingSubtaskTitleId, setEditingSubtaskTitleId] = useState<string | null>(null);
  const [linkedParentSubtask, setLinkedParentSubtask] = useState<TaskSubtask | null>(null);

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
    master_calendar_tag: TaskMasterCalendarTag | null;
  } | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveSeqRef = useRef(0);
  const subtaskAutosaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const subtaskAutosaveSeqRef = useRef<Record<string, number>>({});
  const subtaskDraftsRef = useRef<Record<string, { description?: string; title?: string }>>({});
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const assignee = useMemo(() => profiles.find((p) => p.id === (assigneeId || null)) ?? null, [assigneeId, profiles]);
  const project = useMemo(() => projects.find((p) => p.id === (projectId || null)) ?? null, [projectId, projects]);
  const assignableProfiles = useMemo(() => profiles.filter(isMarketingTeamProfile), [profiles]);
  const mentionableProfiles = useMemo(() => profiles.filter(isMarketingTeamProfile), [profiles]);
  const team = useMemo(() => teams.find((t) => t.id === teamId) ?? null, [teamId, teams]);
  const approverProfile = useMemo(() => profiles.find((p) => p.id === approverUserId) ?? null, [approverUserId, profiles]);
  const attachmentById = useMemo(() => new Map(attachments.map((a) => [a.id, a])), [attachments]);
  const referencedAttachmentIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(commentAttachmentsByCommentId).forEach((list) => {
      list.forEach((id) => ids.add(id));
    });
    return ids;
  }, [commentAttachmentsByCommentId]);
  const taggedMentionLabels = useMemo(() => {
    return commentMentionIds
      .map((id) => {
        const profileForMention = profiles.find((p) => p.id === id);
        return profileForMention ? toOptionLabel(profileForMention) : null;
      })
      .filter((label): label is string => Boolean(label));
  }, [commentMentionIds, profiles]);
  const approverLabel = useMemo(() => {
    if (!approverUserId) return "—";
    return approverProfile ? toOptionLabel(approverProfile) : `${approverUserId.slice(0, 8)}…`;
  }, [approverProfile, approverUserId]);
  const isApprover = profile?.id != null && approverUserId != null && approverUserId === profile.id;
  const canApprove = isCmo || isApprover;
  const statusOptions = useMemo<TaskStatus[]>(() => {
    // Only the assigned approver (or CMO) can set Approved/Closed.
    const all = [...PRIMARY_FLOW, ...SIDE_LANE] as TaskStatus[];
    if (canApprove) return all;
    return all.filter((s) => s !== "approved" && s !== "closed");
  }, [canApprove]);
  const primaryContributor = useMemo(() => {
    const primaryId = assigneeId || task?.created_by || "";
    if (!primaryId) return null;
    return profiles.find((p) => p.id === primaryId) ?? null;
  }, [assigneeId, profiles, task?.created_by]);
  const secondaryContributors = useMemo(() => {
    const primaryId = assigneeId || task?.created_by || "";
    const ids = new Set<string>();
    for (const s of subtasks) {
      if (s.assignee_id && s.assignee_id !== primaryId) {
        ids.add(s.assignee_id);
      }
    }
    return Array.from(ids)
      .map((id) => profiles.find((p) => p.id === id) ?? null)
      .filter((p): p is Profile => Boolean(p));
  }, [assigneeId, profiles, subtasks, task?.created_by]);

  const blockedDependencyChips = useMemo(() => {
    function normalizeDependencyLabel(raw: string) {
      const s = (raw || "").trim();
      return s.replace(/^Ticket:\s*/i, "").replace(/^Subtask:\s*/i, "").trim();
    }

    const chips: Array<{ kind: "ticket" | "subtask"; id: string; label: string }> = [];

    for (const d of taskDependencies) {
      const k = d.blocker_task_id.toLowerCase();
      const label = normalizeDependencyLabel(d.reason?.trim() || linkedTaskTitles[k] || `${k.slice(0, 8)}…`);
      chips.push({ kind: "ticket", id: d.blocker_task_id, label });
    }

    // If this ticket is linked from a subtask, show that subtask's deps too.
    for (const d of linkedFromSubtaskDeps) {
      if (d.blocker_task_id) {
        const k = d.blocker_task_id.toLowerCase();
        const label = normalizeDependencyLabel(d.reason?.trim() || linkedTaskTitles[k] || `${k.slice(0, 8)}…`);
        chips.push({ kind: "ticket", id: d.blocker_task_id, label });
      } else if (d.blocker_subtask_id) {
        const label = normalizeDependencyLabel(d.reason?.trim() || `${d.blocker_subtask_id.slice(0, 8)}…`);
        chips.push({ kind: "subtask", id: d.blocker_subtask_id, label });
      }
    }

    // Dedupe by (kind,id)
    const seen = new Set<string>();
    return chips.filter((c) => {
      const key = `${c.kind}:${c.id.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [linkedFromSubtaskDeps, linkedTaskTitles, taskDependencies]);

  const isDependencyBlocked = useMemo(() => {
    if (taskStatus !== "blocked") return false;
    return blockedDependencyChips.length > 0;
  }, [blockedDependencyChips.length, taskStatus]);

  const SUBTASK_STATUSES: TaskSubtaskStatus[] = ["not_done", "done", "blocked", "on_hold"];
  const TASK_LINK_CLASS =
    "inline-flex max-w-[36ch] items-baseline truncate underline underline-offset-2 decoration-blue-400/60 text-blue-300 hover:text-violet-200 hover:decoration-violet-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30 rounded-sm";
  const DEP_CHIP_CLASS =
    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/80";
  const DEP_REMOVE_CLASS = "text-xs text-white/55 hover:text-white/80 underline underline-offset-2";
  const BLOCKED_BANNER_CLASS =
    "rounded-2xl border border-rose-400/25 bg-rose-500/[0.08] px-4 py-3 shadow-[0_0_26px_rgba(244,63,94,0.18)]";

  const resizeTextareaToContent = useCallback((el: HTMLTextAreaElement | null, maxHeightPx = 320) => {
    if (!el) return;
    // Prevent "weird" giant boxes while still showing everything up to a cap.
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxHeightPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeightPx ? "auto" : "hidden";
  }, []);

  function extractTaskId(raw: string): string | null {
    const s = (raw || "").trim();
    if (!s) return null;
    // Accept raw UUID or full /tasks/<uuid> URL.
    const uuid =
      s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)?.[0] ?? null;
    return uuid ? uuid.toLowerCase() : null;
  }

  function stripDashboardLinkedSubtaskMarkers(text: string) {
    // Hide legacy system markers from the UI (do not auto-mutate stored content).
    return (text || "")
      .replace(/^\s*<!--dashboard:linked-subtask-->\s*\n?/gim, "")
      .replace(/^\s*<!--dashboard:linked-subtask-end-->\s*\n?/gim, "");
  }

  const ensureTaskTitlesLoaded = useCallback(
    async (ids: Array<string | null | undefined>) => {
      const wanted = Array.from(new Set(ids.filter((x): x is string => Boolean(x)).map((x) => x.toLowerCase())));
      if (wanted.length === 0) return;
      const missing = wanted.filter((id) => !(id in linkedTaskTitles) || !(id in linkedTaskDueAt) || !(id in linkedTaskStatus));
      if (missing.length === 0) return;
      try {
        const rows = await listTasksByIds(missing);
        if (!rows || rows.length === 0) return;
        setLinkedTaskTitles((prev) => {
          const next = { ...prev };
          for (const t of rows) {
            const k = t.id.toLowerCase();
            next[k] = t.title || `${k.slice(0, 8)}…`;
          }
          return next;
        });
        setLinkedTaskDueAt((prev) => {
          const next = { ...prev };
          for (const t of rows) {
            const k = t.id.toLowerCase();
            next[k] = (t.due_at ?? null) as string | null;
          }
          return next;
        });
        setLinkedTaskStatus((prev) => {
          const next = { ...prev };
          for (const t of rows) {
            const k = t.id.toLowerCase();
            next[k] = (t.status ?? null) as TaskStatus | null;
          }
          return next;
        });
      } catch {
        // ignore (RLS may block; links still work)
      }
    },
    [linkedTaskDueAt, linkedTaskStatus, linkedTaskTitles]
  );

  function formatDueGuardError(err: unknown, fallback: string) {
    const message = getErrorMessage(err, fallback);
    if (message.toLowerCase().includes("due date cannot be after parent ticket due date")) {
      const date = message.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] ?? null;
      return date ? `Due date can’t be after the parent ticket’s due date (${date}).` : "Due date can’t be after the parent ticket’s due date.";
    }
    return message;
  }
  function subtaskStatusLabel(s: TaskSubtaskStatus) {
    switch (s) {
      case "not_done":
        return "Not done";
      case "done":
        return "Done";
      case "blocked":
        return "Blocked";
      case "on_hold":
        return "On hold";
    }
  }
  function getAssigneeOptionProfiles(selectedId: string | null) {
    if (!selectedId) return assignableProfiles;
    if (assignableProfiles.some((p) => p.id === selectedId)) return assignableProfiles;
    const current = profiles.find((p) => p.id === selectedId) ?? null;
    return current ? [current, ...assignableProfiles] : assignableProfiles;
  }

  const ensureProfilesLoaded = useCallback(
    async (ids: Array<string | null | undefined>) => {
      const wanted = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
      if (wanted.length === 0) return;
      const have = new Set(profiles.map((p) => p.id));
      const missing = wanted.filter((id) => !have.has(id));
      if (missing.length === 0) return;
      try {
        const more = await listProfilesByIds(missing);
        if (!more || more.length === 0) return;
        setProfiles((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          for (const p of more) map.set(p.id, p);
          return Array.from(map.values());
        });
      } catch {
        // ignore (RLS may block)
      }
    },
    [profiles]
  );

  const refreshSubtaskDependencies = useCallback(
    async (subs: TaskSubtask[]) => {
      if (!subs || subs.length === 0) {
        setSubtaskDependencies({});
        return;
      }
      try {
        const rows = await Promise.all(subs.map(async (s) => ({ id: s.id, deps: await listSubtaskDependencies(s.id) })));
        const next: Record<string, TaskSubtaskDependency[]> = {};
        const blockerTaskIds: string[] = [];
        for (const row of rows) {
          next[row.id] = row.deps;
          for (const dep of row.deps) {
            if (dep.blocker_task_id) blockerTaskIds.push(dep.blocker_task_id);
          }
        }
        setSubtaskDependencies(next);
        await ensureTaskTitlesLoaded(blockerTaskIds);
      } catch (e) {
        setStatus(getErrorMessage(e, "Failed to load dependencies"));
      }
    },
    [ensureTaskTitlesLoaded]
  );

  const refresh = useCallback(async () => {
    setLoadingTask(true);
    try {
      setStatus("");
      setCommentsStatus("");
      const [t, ev, subs, teamRows, parentLink, depRows, taskDepRows, attachmentRows] = await Promise.all([
        getTask(taskId),
        listTaskEvents(taskId),
        listTaskSubtasks(taskId),
        listTaskTeams(),
        getLinkedParentSubtask(taskId).catch(() => null),
        listTasks({ statuses: DEPENDENCY_TICKET_STATUSES }).catch(() => [] as Task[]),
        listTaskDependencies(taskId).catch(() => [] as Array<{ id: string; blocker_task_id: string; reason: string | null }>),
        listTaskAttachments(taskId).catch(() => [] as TaskAttachment[])
      ]);
      setTaskState(t);
      setEvents(ev);
      setSubtasks(subs);
      setTeams(teamRows);
      setLinkedParentSubtask(parentLink);
      setAttachments(attachmentRows ?? []);
      // NOTE: listTasks is best-effort (RLS may block in some contexts).
      // Keep the picker small by excluding the current ticket.
      setDependencyTickets(((depRows as Task[]) ?? []).filter((x) => x.id !== taskId));
      setTaskDependencies((taskDepRows ?? []).map((d) => ({ id: d.id, blocker_task_id: d.blocker_task_id, reason: d.reason ?? null })));
      await ensureTaskTitlesLoaded((taskDepRows ?? []).map((d) => d.blocker_task_id));
      await ensureTaskTitlesLoaded([
        ...(subs.map((s) => s.linked_task_id ?? null) ?? []),
        parentLink?.task_id ?? null
      ]);
      await refreshSubtaskDependencies(subs);

      if (parentLink?.id) {
        try {
          const rows = await listSubtaskDependencies(parentLink.id);
          setLinkedFromSubtaskDeps(rows ?? []);
          await ensureTaskTitlesLoaded(rows.map((r) => r.blocker_task_id));
        } catch {
          setLinkedFromSubtaskDeps([]);
        }
      } else {
        setLinkedFromSubtaskDeps([]);
      }
      // Event payloads can include profile IDs (e.g. assignee changes). Load those so the UI can show names.
      const eventProfileIds: Array<string | null | undefined> = [];
      for (const e of ev) {
        eventProfileIds.push(e.actor_id);
        if (e.type === "assignee") {
          eventProfileIds.push(e.from_value);
          eventProfileIds.push(e.to_value);
        }
      }
      await ensureProfilesLoaded([
        t?.created_by,
        t?.assignee_id,
        t?.approver_user_id,
        ...subs.map((s) => s.assignee_id),
        ...eventProfileIds
      ]);
      try {
        const commentRows = await listTaskComments(taskId);
        setComments(commentRows);
        await ensureProfilesLoaded(commentRows.map((c) => c.author_id));
        const [mentionRows, commentAttachmentRows] = await Promise.all([
          listTaskCommentMentions(taskId).catch(() => [] as TaskCommentMention[]),
          listTaskCommentAttachments(taskId).catch(() => [] as TaskCommentAttachment[])
        ]);
        const mentionMap: Record<string, string[]> = {};
        for (const row of mentionRows ?? []) {
          if (!mentionMap[row.comment_id]) mentionMap[row.comment_id] = [];
          mentionMap[row.comment_id].push(row.user_id);
        }
        const attachmentMap: Record<string, string[]> = {};
        for (const row of commentAttachmentRows ?? []) {
          if (!attachmentMap[row.comment_id]) attachmentMap[row.comment_id] = [];
          attachmentMap[row.comment_id].push(row.attachment_id);
        }
        setCommentMentionsByCommentId(mentionMap);
        setCommentAttachmentsByCommentId(attachmentMap);
      } catch (e) {
        setComments([]);
        setCommentMentionsByCommentId({});
        setCommentAttachmentsByCommentId({});
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
        setMasterCalendarTag((t.master_calendar_tag as TaskMasterCalendarTag | null) ?? "");

        lastSavedRef.current = {
          title: t.title ?? "",
          description: t.description ?? null,
          priority: t.priority,
          status: t.status,
          approval_state: t.approval_state,
          team_id: t.team_id ?? null,
          assignee_id: t.assignee_id ?? null,
          project_id: t.project_id ?? null,
          due_at: t.due_at ?? null,
          master_calendar_tag: (t.master_calendar_tag as TaskMasterCalendarTag | null) ?? null
        };
      }
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to load task"));
    } finally {
      setLoadingTask(false);
    }
  }, [ensureProfilesLoaded, ensureTaskTitlesLoaded, refreshSubtaskDependencies, taskId]);

  async function refreshSubtasksOnly() {
    const subs = await listTaskSubtasks(taskId);
    setSubtasks(subs);
    await ensureTaskTitlesLoaded([...(subs.map((s) => s.linked_task_id ?? null) ?? [])]);
    await refreshSubtaskDependencies(subs);
  }

  async function refreshCommentsOnly() {
    try {
      setCommentsStatus("");
      const rows = await listTaskComments(taskId);
      setComments(rows);
      const [mentionRows, commentAttachmentRows] = await Promise.all([
        listTaskCommentMentions(taskId).catch(() => [] as TaskCommentMention[]),
        listTaskCommentAttachments(taskId).catch(() => [] as TaskCommentAttachment[])
      ]);
      const mentionMap: Record<string, string[]> = {};
      for (const row of mentionRows ?? []) {
        if (!mentionMap[row.comment_id]) mentionMap[row.comment_id] = [];
        mentionMap[row.comment_id].push(row.user_id);
      }
      const attachmentMap: Record<string, string[]> = {};
      for (const row of commentAttachmentRows ?? []) {
        if (!attachmentMap[row.comment_id]) attachmentMap[row.comment_id] = [];
        attachmentMap[row.comment_id].push(row.attachment_id);
      }
      setCommentMentionsByCommentId(mentionMap);
      setCommentAttachmentsByCommentId(attachmentMap);
    } catch (e) {
      setComments([]);
      setCommentMentionsByCommentId({});
      setCommentAttachmentsByCommentId({});
      setCommentsStatus(getErrorMessage(e, "Failed to load comments"));
    }
  }

  async function onUploadAttachments(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!profile) {
      setAttachmentsStatus("Sign in to upload attachments.");
      return;
    }
    setAttachmentsStatus("");
    setUploadingAttachments(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setAttachmentsStatus(`"${file.name}" exceeds 50 MB.`);
          continue;
        }
        const fileName = sanitizeFileName(file.name);
        const key = `tasks/${taskId}/${crypto.randomUUID()}-${fileName}`;
        const { error: uploadErr } = await supabase.storage.from("task-attachments").upload(key, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false
        });
        if (uploadErr) {
          setAttachmentsStatus(uploadErr.message || "Failed to upload attachment.");
          continue;
        }
        const created = await createTaskAttachment({
          task_id: taskId,
          uploader_id: profile.id,
          storage_path: key,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size
        });
        setAttachments((prev) => [created, ...prev]);
      }
    } catch (e) {
      setAttachmentsStatus(getErrorMessage(e, "Failed to upload attachment."));
    } finally {
      setUploadingAttachments(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  }

  async function onDownloadAttachment(att: TaskAttachment) {
    try {
      const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(att.storage_path, 60 * 10);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setAttachmentsStatus(getErrorMessage(e, "Failed to open attachment."));
    }
  }

  async function onDeleteAttachment(att: TaskAttachment) {
    if (!profile) return;
    setAttachmentsStatus("");
    try {
      await supabase.storage.from("task-attachments").remove([att.storage_path]);
    } catch {
      // best-effort; continue to delete DB row
    }
    try {
      await deleteTaskAttachment(att.id);
      setAttachments((prev) => prev.filter((row) => row.id !== att.id));
      setCommentAttachmentIds((prev) => prev.filter((id) => id !== att.id));
      setCommentAttachmentsByCommentId((prev) => {
        const next: Record<string, string[]> = {};
        Object.entries(prev).forEach(([commentId, list]) => {
          const filtered = list.filter((id) => id !== att.id);
          if (filtered.length > 0) next[commentId] = filtered;
        });
        return next;
      });
    } catch (e) {
      setAttachmentsStatus(getErrorMessage(e, "Failed to delete attachment."));
    }
  }

  function syncMentionIds(nextBody: string, ids: string[]) {
    if (ids.length === 0) return ids;
    return ids.filter((id) => {
      const profile = mentionableProfiles.find((p) => p.id === id);
      if (!profile) return false;
      const label = toOptionLabel(profile);
      return nextBody.includes(`@${label}`);
    });
  }

  const renderCommentBody = useCallback(
    (body: string, mentionIds: string[]) => {
      if (!mentionIds || mentionIds.length === 0) return body;
      const labels = Array.from(
        new Set(
          mentionIds
            .map((id) => profiles.find((p) => p.id === id))
            .filter(Boolean)
            .map((p) => (p ? toOptionLabel(p) : ""))
            .filter((label) => label.length > 0)
        )
      );
      if (labels.length === 0) return body;
      const escaped = labels.map(escapeRegExp).sort((a, b) => b.length - a.length);
      const pattern = new RegExp(`@(${escaped.join("|")})`, "g");
      const nodes: ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null = null;
      let tokenIndex = 0;
      while ((match = pattern.exec(body)) !== null) {
        if (match.index > lastIndex) {
          nodes.push(body.slice(lastIndex, match.index));
        }
        const label = match[1] ?? "";
        nodes.push(
          <span key={`${label}-${match.index}-${tokenIndex++}`} className="font-medium text-sky-200">
            {label}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < body.length) {
        nodes.push(body.slice(lastIndex));
      }
      return nodes.length > 0 ? nodes : body;
    },
    [profiles]
  );

  function updateMentionSearch(nextBody: string, caret: number) {
    const upto = nextBody.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at < 0) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      return;
    }
    const before = upto[at - 1];
    if (at > 0 && before && !/\s/.test(before)) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      return;
    }
    const query = upto.slice(at + 1);
    if (query.includes(" ") || query.includes("\n")) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(query);
    setMentionStart(at);
  }

  function onInsertMention(profileToInsert: Profile) {
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart ?? commentBody.length;
    const start = mentionStart ?? commentBody.lastIndexOf("@");
    const label = toOptionLabel(profileToInsert);
    const before = commentBody.slice(0, Math.max(0, start));
    const after = commentBody.slice(caret);
    const next = `${before}@${label} ${after}`;
    setCommentBody(next);
    setCommentMentionIds((prev) => Array.from(new Set([...prev, profileToInsert.id])));
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
    requestAnimationFrame(() => {
      const nextPos = Math.max(0, start) + label.length + 2;
      textarea.focus();
      textarea.setSelectionRange(nextPos, nextPos);
    });
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
      const mentionIds = syncMentionIds(body, commentMentionIds);
      const attachmentIds = commentAttachmentIds;
      if (mentionIds.length > 0) {
        await createTaskCommentMentions(
          mentionIds.map((userId) => ({ comment_id: created.id, user_id: userId }))
        );
      }
      if (attachmentIds.length > 0) {
        await createTaskCommentAttachments(
          attachmentIds.map((attachmentId) => ({ comment_id: created.id, attachment_id: attachmentId }))
        );
      }
      setCommentBody("");
      setCommentMentionIds([]);
      setCommentAttachmentIds([]);
      setMentionOpen(false);
      setComments((prev) => [...prev, created]);
      if (commentMentionIds.length > 0) {
        setCommentMentionsByCommentId((prev) => ({ ...prev, [created.id]: mentionIds }));
      }
      if (commentAttachmentIds.length > 0) {
        setCommentAttachmentsByCommentId((prev) => ({ ...prev, [created.id]: attachmentIds }));
      }
      setStatus("Comment added.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to add comment"));
      await refreshCommentsOnly().catch(() => null);
    } finally {
      setSavingComment(false);
    }
  }

  function onEditComment(comment: TaskComment) {
    if (!profile) return;
    if (comment.author_id !== profile.id) return;
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
  }

  function onCancelEditComment() {
    setEditingCommentId("");
    setEditingBody("");
  }

  async function onSaveCommentEdit(id: string) {
    if (!profile) return;
    const existing = comments.find((c) => c.id === id) ?? null;
    if (!existing || existing.author_id !== profile.id) return;
    const body = editingBody.trim();
    if (!body) return;
    setSavingComment(true);
    setStatus("Saving comment…");
    try {
      setCommentsStatus("");
      const updated = await updateTaskComment(id, { body });
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
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
    if (!profile) return;
    const existing = comments.find((c) => c.id === id) ?? null;
    if (!existing) return;
    const canDeleteThisComment = existing.author_id === profile.id || isMarketingManagerProfile(profile);
    if (!canDeleteThisComment) return;
    const prompt =
      existing.author_id === profile.id ? "Delete this comment?" : "Delete this comment (as a marketing manager)?";
    if (!confirm(prompt)) return;
    setSavingComment(true);
    setStatus("Deleting comment…");
    try {
      setCommentsStatus("");
      await deleteTaskComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCommentMentionsByCommentId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setCommentAttachmentsByCommentId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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

  useLayoutEffect(() => {
    if (!editingDescription) return;
    resizeTextareaToContent(descriptionTextareaRef.current);
  }, [description, editingDescription, resizeTextareaToContent]);

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

    const prev = lastSavedRef.current;
    const canEditDetailsOrProperties = canEditDetails || canEditProperties;
    const trimmedTitle = title.trim();
    const nextDescription = description.trim() ? description.trim() : null;
    let patch: Parameters<typeof updateTask>[1] | null = null;
    let nextSnapshot: typeof prev | null = null;

    if (canEditDetailsOrProperties) {
      if (canEditDetails && !trimmedTitle) {
        // Don't persist invalid state; allow user to keep typing.
        return;
      }

      const next = {
        title: canEditDetails ? trimmedTitle : prev.title,
        description: nextDescription,
        priority,
        status: taskStatus,
        approval_state: approvalState,
        team_id: teamId || null,
        assignee_id: assigneeId || null,
        project_id: projectId || null,
        due_at: dueAt || null,
        master_calendar_tag: masterCalendarTag || null
      };

      const changed =
        next.title !== prev.title ||
        next.description !== prev.description ||
        next.priority !== prev.priority ||
        next.status !== prev.status ||
        next.approval_state !== prev.approval_state ||
        next.team_id !== prev.team_id ||
        next.assignee_id !== prev.assignee_id ||
        next.project_id !== prev.project_id ||
        next.due_at !== prev.due_at ||
        next.master_calendar_tag !== prev.master_calendar_tag;
      if (!changed) return;

      patch = next;
      nextSnapshot = next;
    } else if (canEditDescription) {
      if (nextDescription === prev.description) return;
      patch = { description: nextDescription };
      nextSnapshot = { ...prev, description: nextDescription };
    } else {
      return;
    }
    if (!patch || !nextSnapshot) return;
    const patchToSave = patch;
    const snapshotToSave = nextSnapshot;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const seq = ++autosaveSeqRef.current;
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setStatus("Saving…");
        await updateTask(taskId, patchToSave);
        if (autosaveSeqRef.current !== seq) return; // superseded
        lastSavedRef.current = snapshotToSave;
        setTaskState((t) =>
          t
            ? {
                ...t,
                ...snapshotToSave,
                assignee_id: snapshotToSave.assignee_id,
                project_id: snapshotToSave.project_id,
                due_at: snapshotToSave.due_at
              }
            : t
        );
        setStatus("Saved.");
      } catch (e) {
        if (autosaveSeqRef.current !== seq) return;
        setStatus(formatDueGuardError(e, "Failed to save"));
      }
    }, 650);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [
    approvalState,
    assigneeId,
    canEditDescription,
    canEditDetails,
    canEditProperties,
    canEditTask,
    description,
    dueAt,
    masterCalendarTag,
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
    if (!canCreateSubtasks) return;
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

  async function onUpdateSubtask(
    id: string,
    patch: Partial<Pick<TaskSubtask, "title" | "description" | "status" | "assignee_id" | "linked_task_id" | "due_at" | "effort_points">>
  ) {
    if (!canEditSubtasks) return;
    setStatus("Saving subtask…");
    const snapshot = subtasks;
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const updated = await updateTaskSubtask(id, patch);
      setSubtasks((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setStatus("Subtask saved.");
    } catch (e) {
      setSubtasks(snapshot);
      await refreshSubtasksOnly().catch(() => null);
      setStatus(e instanceof Error ? e.message : "Failed to save subtask");
    }
  }

  function onUpdateSubtaskDescriptionDraft(id: string, nextDescription: string) {
    if (!canEditSubtasks) return;
    // Update UI immediately.
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, description: nextDescription } : s)));
    setSubtaskDrafts((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] ?? {}), description: nextDescription } };
      subtaskDraftsRef.current = next;
      return next;
    });

    // Debounce network saves to avoid input jitter from out-of-order responses.
    const prevTimer = subtaskAutosaveTimersRef.current[id];
    if (prevTimer) clearTimeout(prevTimer);
    const seq = (subtaskAutosaveSeqRef.current[id] ?? 0) + 1;
    subtaskAutosaveSeqRef.current[id] = seq;
    subtaskAutosaveTimersRef.current[id] = setTimeout(async () => {
      const draft = subtaskDraftsRef.current[id]?.description ?? nextDescription;
      try {
        setStatus("Saving subtask…");
        const updated = await updateTaskSubtask(id, { description: draft });
        if (subtaskAutosaveSeqRef.current[id] !== seq) return; // superseded
        setSubtasks((prev) => prev.map((s) => (s.id === id ? updated : s)));
        setSubtaskDrafts((prev) => {
          const copy = { ...prev };
          delete copy[id];
          subtaskDraftsRef.current = copy;
          return copy;
        });
        setStatus("Subtask saved.");
      } catch (e) {
        if (subtaskAutosaveSeqRef.current[id] !== seq) return;
        setStatus(getErrorMessage(e, "Failed to save subtask"));
        await refreshSubtasksOnly().catch(() => null);
      }
    }, 450);
  }

  function onUpdateSubtaskTitleDraft(id: string, nextTitle: string) {
    const subtask = subtasks.find((s) => s.id === id);
    if (!subtask || !canEditSubtaskTitle(subtask)) return;
    // Update UI immediately.
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, title: nextTitle } : s)));
    setSubtaskDrafts((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] ?? {}), title: nextTitle } };
      subtaskDraftsRef.current = next;
      return next;
    });

    // Debounce network saves to avoid input jitter from out-of-order responses.
    const prevTimer = subtaskAutosaveTimersRef.current[id];
    if (prevTimer) clearTimeout(prevTimer);
    const seq = (subtaskAutosaveSeqRef.current[id] ?? 0) + 1;
    subtaskAutosaveSeqRef.current[id] = seq;
    subtaskAutosaveTimersRef.current[id] = setTimeout(async () => {
      const draft = subtaskDraftsRef.current[id]?.title ?? nextTitle;
      if (!draft.trim()) {
        // Don't save empty titles
        setSubtaskDrafts((prev) => {
          const copy = { ...prev };
          delete copy[id];
          subtaskDraftsRef.current = copy;
          return copy;
        });
        await refreshSubtasksOnly().catch(() => null);
        return;
      }
      try {
        setStatus("Saving subtask…");
        const updated = await updateTaskSubtask(id, { title: draft });
        if (subtaskAutosaveSeqRef.current[id] !== seq) return; // superseded
        setSubtasks((prev) => prev.map((s) => (s.id === id ? updated : s)));
        setSubtaskDrafts((prev) => {
          const copy = { ...prev };
          delete copy[id];
          subtaskDraftsRef.current = copy;
          return copy;
        });
        setStatus("Subtask saved.");
      } catch (e) {
        if (subtaskAutosaveSeqRef.current[id] !== seq) return;
        setStatus(getErrorMessage(e, "Failed to save subtask"));
        await refreshSubtasksOnly().catch(() => null);
      }
    }, 450);
  }

  async function onUpdateSubtaskLink(subtask: TaskSubtask, nextLinkedId: string | null) {
    if (!profile || !isMarketingTeamProfile(profile)) return;
    if (linkedParentSubtask?.task_id) {
      setStatus("Linked tickets can only be managed from the parent ticket.");
      return;
    }
    if (!canManageSubtaskLinks(subtask)) return;
    setStatus("Linking ticket…");
    const snapshot = subtasks;
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, linked_task_id: nextLinkedId } : s)));
    try {
      const updated = await updateTaskSubtask(subtask.id, { linked_task_id: nextLinkedId });
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? updated : s)));
      await ensureTaskTitlesLoaded([updated.linked_task_id]);
      setStatus(nextLinkedId ? "Ticket linked." : "Ticket unlinked.");
    } catch (e) {
      setSubtasks(snapshot);
      await refreshSubtasksOnly().catch(() => null);
      setStatus(getErrorMessage(e, "Failed to link ticket"));
    }
  }

  async function onCreateSubtaskDependency(subtask: TaskSubtask, kind: "task" | "subtask", blockerId: string) {
    if (!canEditSubtasks) return;
    const id = (blockerId || "").trim().toLowerCase();
    if (!id) return;
    if (kind === "task" && subtask.linked_task_id && id === subtask.linked_task_id.toLowerCase()) {
      setStatus("That ticket is created from this subtask; it can't be a dependency for itself.");
      return;
    }
    if (kind === "subtask" && id === subtask.id) {
      setStatus("Subtask cannot depend on itself.");
      return;
    }
    setStatus("Adding dependency…");
    try {
      const autoReason = (() => {
        if (kind === "task") {
          const title =
            dependencyTickets.find((t) => t.id.toLowerCase() === id)?.title ||
            linkedTaskTitles[id] ||
            `${id.slice(0, 8)}…`;
          return `Ticket: ${title}`;
        }
        const blockerSubtask = subtasks.find((s) => s.id.toLowerCase() === id) ?? null;
        const label = blockerSubtask?.title?.trim() || `${id.slice(0, 8)}…`;
        return `Subtask: ${label}`;
      })();

      await createSubtaskDependency({
        blocked_subtask_id: subtask.id,
        blocker_task_id: kind === "task" ? id : null,
        blocker_subtask_id: kind === "subtask" ? id : null,
        reason: autoReason
      });
      await refreshSubtasksOnly();
      setStatus("Dependency added.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to add dependency"));
      await refreshSubtaskDependencies(subtasks).catch(() => null);
    } finally {
      // Close any open picker UI for this subtask.
      setSubtaskDependencyAction((prev) => ({ ...prev, [subtask.id]: "" }));
      setSubtaskDependencyPickerValue((prev) => ({ ...prev, [subtask.id]: "" }));
    }
  }

  async function onRemoveSubtaskDependency(subtaskId: string, dependencyId: string) {
    if (!canEditSubtasks) return;
    setStatus("Removing dependency…");
    try {
      await deleteSubtaskDependency(dependencyId);
      await refreshSubtasksOnly();
      setStatus("Dependency removed.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to remove dependency"));
      await refreshSubtaskDependencies(subtasks).catch(() => null);
    }
  }

  async function onCreateTaskDependency(blockerTaskId: string) {
    if (!canEditStatus) return;
    const id = (blockerTaskId || "").trim().toLowerCase();
    if (!id) return;
    if (id === taskId.toLowerCase()) return;
    if (linkedParentSubtask?.task_id) {
      // Linked tickets are blocked by parent subtasks; task-to-task dependencies are still allowed,
      // but we keep the UX simple and disallow editing for linked tickets for now.
      setStatus("Dependencies can only be managed from the parent ticket.");
      return;
    }
    setStatus("Adding dependency…");
    try {
      const title =
        dependencyTickets.find((t) => t.id.toLowerCase() === id)?.title ||
        linkedTaskTitles[id] ||
        `${id.slice(0, 8)}…`;
      await createTaskDependency({ blocker_task_id: id, blocked_task_id: taskId, reason: `Ticket: ${title}` });
      setTaskDependencyPickerValue("");
      await refresh().catch(() => null);
      setStatus("Dependency added.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to add dependency"));
      await refresh().catch(() => null);
    }
  }

  async function onRemoveTaskDependency(dependencyId: string) {
    if (!canEditStatus) return;
    if (linkedParentSubtask?.task_id) {
      setStatus("Dependencies can only be managed from the parent ticket.");
      return;
    }
    setStatus("Removing dependency…");
    try {
      await deleteTaskDependency(dependencyId);
      await refresh().catch(() => null);
      setStatus("Dependency removed.");
    } catch (e) {
      setStatus(getErrorMessage(e, "Failed to remove dependency"));
      await refresh().catch(() => null);
    }
  }

  async function onLinkExistingTicketForSubtask(subtask: TaskSubtask) {
    if (!profile || !isMarketingTeamProfile(profile)) return;
    if (linkedParentSubtask?.task_id) {
      setStatus("Linked tickets can only be managed from the parent ticket.");
      return;
    }
    if (!canManageSubtaskLinks(subtask)) return;
    const raw = prompt("Paste the ticket URL or ID to link to this subtask:");
    if (!raw) return;
    const linkedId = extractTaskId(raw);
    if (!linkedId) {
      setStatus("Could not detect a ticket ID. Paste a /tasks/<id> link or UUID.");
      return;
    }
    await onUpdateSubtaskLink(subtask, linkedId);
  }

  async function onCreateDesignTicketForSubtask(subtask: TaskSubtask) {
    if (!profile || !isMarketingTeamProfile(profile)) return;
    if (linkedParentSubtask?.task_id) {
      setStatus("Linked tickets can only be managed from the parent ticket.");
      return;
    }
    if (!canManageSubtaskLinks(subtask)) return;
    const designTeam = teams.find((t) => t.name.toLowerCase().includes("design")) ?? null;
    if (!designTeam) {
      setStatus("No Design team found. Create a Team named “Design” (or similar) first.");
      return;
    }
    setStatus("Creating design ticket…");
    try {
      const deps = subtaskDependencies[subtask.id] ?? [];
      const block = [
        `Subtask: ${subtask.title}`,
        "Subtask details:",
        subtask.description || "",
      ]
        .join("\n")
        .trimEnd();
      const prefix = normalizeTicketPrefix(designTeam.ticket_prefix ?? "DES") ?? "DES";
      const ticketNumber = await nextTeamTicketNumber(prefix);
      const designTitle = formatTicketTitle(prefix, ticketNumber, subtask.title);
      const created = await createTask({
        title: designTitle,
        description: block,
        team_id: designTeam.id,
        project_id: projectId || null,
        // Route initial work to design approver (triage), and team-based approval stays on the Design team.
        assignee_id: designTeam.approver_user_id ?? null,
        due_at: (subtask.due_at ?? dueAt ?? null) || null,
        ...(deps.length > 0 ? { status: "blocked" as TaskStatus } : {})
      });
      // Make the next click feel instant + avoid a "missing title" flash.
      router.prefetch(`/tasks/${created.id}`);
      setLinkedTaskTitles((prev) => ({
        ...prev,
        [created.id.toLowerCase()]: created.title || designTitle
      }));
      setLinkedTaskDueAt((prev) => ({ ...prev, [created.id.toLowerCase()]: (created.due_at ?? null) as string | null }));
      setLinkedTaskStatus((prev) => ({ ...prev, [created.id.toLowerCase()]: (created.status ?? null) as TaskStatus | null }));
      await onUpdateSubtaskLink(subtask, created.id);
      setStatus("Design ticket created.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create design ticket");
    }
  }

  async function onCreateProductionTicketForSubtask(subtask: TaskSubtask) {
    if (!profile || !isMarketingTeamProfile(profile)) return;
    if (linkedParentSubtask?.task_id) {
      setStatus("Linked tickets can only be managed from the parent ticket.");
      return;
    }
    if (!canManageSubtaskLinks(subtask)) return;
    const productionTeam = teams.find((t) => t.name.toLowerCase().includes("production")) ?? null;
    if (!productionTeam) {
      setStatus("No Production team found. Create a Team named “Production” (or similar) first.");
      return;
    }
    setStatus("Creating production ticket…");
    try {
      const deps = subtaskDependencies[subtask.id] ?? [];
      const block = [
        `Subtask: ${subtask.title}`,
        "Subtask details:",
        subtask.description || "",
      ]
        .join("\n")
        .trimEnd();
      const prefix = normalizeTicketPrefix(productionTeam.ticket_prefix ?? "PROD") ?? "PROD";
      const ticketNumber = await nextTeamTicketNumber(prefix);
      const productionTitle = formatTicketTitle(prefix, ticketNumber, subtask.title);
      const created = await createTask({
        title: productionTitle,
        description: block,
        team_id: productionTeam.id,
        project_id: projectId || null,
        // Route initial work to production approver (triage).
        assignee_id: productionTeam.approver_user_id ?? null,
        due_at: (subtask.due_at ?? dueAt ?? null) || null,
        ...(deps.length > 0 ? { status: "blocked" as TaskStatus } : {})
      });
      router.prefetch(`/tasks/${created.id}`);
      setLinkedTaskTitles((prev) => ({
        ...prev,
        [created.id.toLowerCase()]: created.title || productionTitle
      }));
      setLinkedTaskDueAt((prev) => ({ ...prev, [created.id.toLowerCase()]: (created.due_at ?? null) as string | null }));
      setLinkedTaskStatus((prev) => ({ ...prev, [created.id.toLowerCase()]: (created.status ?? null) as TaskStatus | null }));
      await onUpdateSubtaskLink(subtask, created.id);
      setStatus("Production ticket created.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create production ticket");
    }
  }

  async function onRemoveSubtask(id: string) {
    if (!canEditSubtasks) return;
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
    if (taskStatus !== "submitted") return;
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
    if (!canEditStatus) return;
    const dependencyLocked =
      taskStatus === "blocked" && (taskDependencies.length > 0 || linkedFromSubtaskDeps.length > 0);
    if (dependencyLocked && next !== "blocked") {
      setStatus("This ticket is blocked by dependencies. Resolve them before changing status.");
      return;
    }
    if ((next === "approved" || next === "closed") && !canApprove) {
      setStatus("Only the assigned approver can approve or close this ticket.");
      return;
    }
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
        if (canApprove && (next === "queued" || next === "in_progress" || next === "submitted")) {
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

              {isDependencyBlocked ? (
                <div className="mt-4">
                  <div className={BLOCKED_BANNER_CLASS}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-rose-200/90">Blocked by dependencies</div>
                        <div className="mt-1 text-sm text-white/80">
                          Resolve the dependency items below to unlock status changes.
                        </div>
                      </div>
                      <div className="text-xs text-white/55">Status is locked</div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {blockedDependencyChips.map((c) => {
                        if (c.kind === "ticket") {
                          const href = `/tasks/${c.id}`;
                          return (
                            <span key={`${c.kind}:${c.id}`} className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/[0.06] px-3 py-1 text-xs text-white/85">
                              <span className="text-rose-200/90">Ticket</span>
                              <button type="button" className={TASK_LINK_CLASS} onClick={() => router.push(href)}>
                                {c.label}
                              </button>
                            </span>
                          );
                        }
                        return (
                          <span key={`${c.kind}:${c.id}`} className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/[0.06] px-3 py-1 text-xs text-white/85">
                            <span className="text-rose-200/90">Subtask</span>
                            <span>{c.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {taskStatus !== "closed" ? (
                  <AppButton
                    intent="secondary"
                    size="sm"
                    className="h-10 px-4"
                    onPress={() => onSetStatus("in_progress")}
                    isDisabled={!canEditStatus || isDependencyBlocked}
                  >
                    Start work
                  </AppButton>
                ) : null}
                <AppButton
                  intent="secondary"
                  size="sm"
                  className="h-10 px-4"
                  onPress={() => onSetStatus("submitted")}
                  isDisabled={!canEditStatus || isDependencyBlocked || taskStatus === "closed" || !teamId || !approverUserId}
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
                        isDisabled={!canEditStatus}
                      >
                        Reopen ticket
                      </AppButton>
                    ) : (
                      <AppButton
                        intent="primary"
                        size="sm"
                        className="h-10 px-4"
                        onPress={() => onSetStatus("closed")}
                        isDisabled={!canApprove || approvalState !== "approved"}
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

                {linkedParentSubtask?.task_id ? (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/45">Linked Parent Ticket</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={TASK_LINK_CLASS}
                        onClick={() => router.push(`/tasks/${linkedParentSubtask.task_id}`)}
                      >
                        {linkedTaskTitles[linkedParentSubtask.task_id.toLowerCase()] ||
                          `${linkedParentSubtask.task_id.slice(0, 8)}…`}
                      </button>
                    </div>
                    {(() => {
                      const parentId = linkedParentSubtask.task_id.toLowerCase();
                      const parentDue = linkedTaskDueAt[parentId] ?? null;
                      const parentStatus = linkedTaskStatus[parentId] ?? null;
                      const parentOpen = parentStatus ? parentStatus !== "closed" && parentStatus !== "dropped" : true;
                      const childDue = dueAt || null;
                      const outOfSync = Boolean(parentOpen && parentDue && childDue && childDue > parentDue);
                      if (!outOfSync) return null;
                      return (
                        <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-200/90">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[11px] font-bold text-rose-200">
                            !
                          </span>{" "}
                          <span className="font-semibold">Due date correction needed.</span> This ticket’s due date ({childDue}) is after the parent ticket due
                          date ({parentDue}).
                        </div>
                      );
                    })()}
                  </div>
                ) : null}

                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Description (optional)</div>
                  {canEditDescription && editingDescription ? (
                    <textarea
                      ref={descriptionTextareaRef}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        resizeTextareaToContent(e.currentTarget);
                      }}
                      disabled={!canEditDescription}
                      rows={4}
                      className="mt-2 w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20 transition-[height] duration-150 ease-out"
                      placeholder="No long explanations. Just enough context."
                      onBlur={() => setEditingDescription(false)}
                      autoFocus
                    />
                  ) : (
                    <div
                      className={[
                        "mt-2 w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85",
                        canEditDescription ? "cursor-text" : ""
                      ].join(" ")}
                      onClick={() => {
                        if (!canEditDescription) return;
                        setEditingDescription(true);
                      }}
                    >
                      {description?.trim() ? (
                        <div className="whitespace-pre-wrap">{stripDashboardLinkedSubtaskMarkers(description)}</div>
                      ) : (
                        <div className="text-white/35">{canEditDescription ? "Click to add a description…" : "No description."}</div>
                      )}
                    </div>
                  )}
                </div>

                {!canEditProperties ? (
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
                        disabled={!canCreateSubtasks}
                        placeholder="Add a subtask…"
                        className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                      />
                    </div>
                    <AppButton
                      intent="secondary"
                      className="h-11 px-6"
                      onPress={onCreateSubtask}
                      isDisabled={!canCreateSubtasks || !newSubtaskTitle.trim()}
                    >
                      Add
                    </AppButton>
                  </div>
                  <div className="mt-3 space-y-2">
                    {subtasks.length === 0 ? <div className="text-sm text-white/50">No subtasks yet.</div> : null}
                    {subtasks.map((s) => {
                      const canEditTitle = canEditSubtaskTitle(s);
                      const isEditingTitle = editingSubtaskTitleId === s.id;
                      const titleValue = subtaskDrafts[s.id]?.title ?? s.title ?? "";
                      const assigneeProfileForRow = profiles.find((p) => p.id === (s.assignee_id ?? "")) ?? null;
                      const assigneeLabelForRow = s.assignee_id
                        ? assigneeProfileForRow
                          ? toOptionLabel(assigneeProfileForRow)
                          : `${s.assignee_id.slice(0, 8)}…`
                        : "Unassigned";
                      const effectiveSubtaskDueAt =
                        s.due_at ??
                        (s.linked_task_id ? (linkedTaskDueAt[s.linked_task_id.toLowerCase()] ?? null) : null);
                      return (
                        <details
                          key={s.id}
                          className="group glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                        >
                          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 select-none">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="mt-0.5 text-white/35 transition-transform duration-150 group-open:rotate-90">›</span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white/90 truncate">{s.title || "Untitled subtask"}</div>
                                <div className="mt-0.5 text-xs text-white/55">
                                  With <span className="text-white/75">{assigneeLabelForRow}</span> ·{" "}
                                  <span className="text-white/70">{subtaskStatusLabel(s.status)}</span>
                                  {effectiveSubtaskDueAt ? (
                                    <>
                                      {" "}
                                      · <span className="tabular-nums text-white/70">Due {effectiveSubtaskDueAt}</span>
                                    </>
                                  ) : null}
                                  {s.linked_task_id ? (
                                    <>
                                      {" "}
                                      · <span className="text-white/50">Linked</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {s.status === "blocked" ? (
                                <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/[0.12] px-2 py-0.5 text-[11px] text-rose-100">
                                  Blocked
                                </span>
                              ) : null}
                            </div>
                          </summary>

                          <div className="mt-4">
                            {/* Title Section - Full Width */}
                            <div className="mb-4">
                            {isEditingTitle && canEditTitle ? (
                              <input
                                type="text"
                                value={titleValue}
                                onChange={(e) => onUpdateSubtaskTitleDraft(s.id, e.target.value)}
                                onBlur={() => {
                                  // Save on blur if changed
                                  const draft = subtaskDrafts[s.id]?.title;
                                  if (draft !== undefined && draft !== s.title && draft.trim()) {
                                    // The autosave will handle it, but we can close editing
                                  }
                                  setEditingSubtaskTitleId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  } else if (e.key === "Escape") {
                                    setSubtaskDrafts((prev) => {
                                      const copy = { ...prev };
                                      delete copy[s.id];
                                      subtaskDraftsRef.current = copy;
                                      return copy;
                                    });
                                    setEditingSubtaskTitleId(null);
                                  }
                                }}
                                autoFocus
                                className="w-full glass-inset rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-base font-semibold text-white/90 outline-none focus:border-white/20 focus:bg-white/[0.04] transition-colors"
                                placeholder="Subtask title…"
                              />
                            ) : (
                              <div
                                className={[
                                  "text-base font-semibold text-white/90 leading-relaxed",
                                  canEditTitle ? "cursor-text hover:text-white transition-colors" : ""
                                ].join(" ")}
                                onClick={() => {
                                  if (canEditTitle) {
                                    setEditingSubtaskTitleId(s.id);
                                  }
                                }}
                                title={canEditTitle ? "Click to edit" : ""}
                              >
                                {s.title || "Untitled subtask"}
                              </div>
                            )}
                          </div>

                          {s.status === "blocked" ? (
                            <div className="mb-4">
                              <div className={BLOCKED_BANNER_CLASS}>
                                <div className="text-xs uppercase tracking-widest text-rose-200/90">Blocked</div>
                                <div className="mt-1 text-sm text-white/80">
                                  {(subtaskDependencies[s.id]?.length ?? 0) > 0
                                    ? "This subtask is blocked by dependencies."
                                    : "This subtask is marked as blocked."}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {/* Controls Row */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-[140px] flex-1 md:flex-none">
                              <PillSelect
                                value={s.status}
                                onChange={(v) => onUpdateSubtask(s.id, { status: v as TaskSubtaskStatus })}
                                ariaLabel="Subtask status"
                                disabled={!canEditSubtasks || Boolean(s.linked_task_id)}
                              >
                                {SUBTASK_STATUSES.map((st) => (
                                  <option key={st} value={st} className="bg-zinc-900">
                                    {subtaskStatusLabel(st)}
                                  </option>
                                ))}
                              </PillSelect>
                            </div>
                            <div className="min-w-[160px] flex-1 md:flex-none">
                              <PillSelect
                                value={s.assignee_id ?? ""}
                                onChange={(v) => onUpdateSubtask(s.id, { assignee_id: v || null })}
                                ariaLabel="Subtask assignee"
                                disabled={!canEditSubtasks || Boolean(s.linked_task_id)}
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
                            </div>
                            <AppButton
                              intent="danger"
                              size="sm"
                              className="h-10 px-4 shrink-0"
                              onPress={() => onRemoveSubtask(s.id)}
                              isDisabled={!canEditSubtasks}
                            >
                              Delete
                            </AppButton>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <div className="text-[11px] uppercase tracking-widest text-white/40">Linked ticket</div>
                          {s.linked_task_id ? (
                            <>
                              {(() => {
                                const parentDue = dueAt || null;
                                const k = s.linked_task_id.toLowerCase();
                                const linkedDue = linkedTaskDueAt[k] ?? null;
                                const linkedStatus = linkedTaskStatus[k] ?? null;
                                const linkedOpen = linkedStatus ? linkedStatus !== "closed" && linkedStatus !== "dropped" : true;
                                const outOfSync =
                                  Boolean(parentDue && linkedDue && linkedDue > parentDue && linkedOpen);
                                return outOfSync ? (
                                  <div className="w-full text-xs text-rose-200/90">
                                    Due date course-correct needed: linked ticket due date ({linkedDue}) is after parent due date ({parentDue}).
                                  </div>
                                ) : null;
                              })()}
                              <button
                                type="button"
                                className={TASK_LINK_CLASS}
                                onClick={() => router.push(`/tasks/${s.linked_task_id}`)}
                              >
                                {linkedTaskTitles[s.linked_task_id.toLowerCase()] || `${s.linked_task_id.slice(0, 8)}…`}
                              </button>
                              <div className="text-xs text-white/45">Status + assignee + due date sync from linked ticket.</div>
                              {canManageSubtaskLinks(s) ? (
                                <AppButton
                                  intent="secondary"
                                  size="sm"
                                  className="h-9 px-4"
                                  onPress={() => void onUpdateSubtaskLink(s, null)}
                                >
                                  Unlink
                                </AppButton>
                              ) : null}
                            </>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {canManageSubtaskLinks(s) ? (
                                <>
                                  <PillSelect
                                    value={subtaskLinkAction[s.id] ?? ""}
                                    onChange={(v) => {
                                      const next = (v as "" | "existing" | "design" | "production") ?? "";
                                      setSubtaskLinkAction((prev) => ({ ...prev, [s.id]: next }));
                                      if (next === "existing") {
                                        void onLinkExistingTicketForSubtask(s).finally(() =>
                                          setSubtaskLinkAction((prev) => ({ ...prev, [s.id]: "" }))
                                        );
                                      } else if (next === "design") {
                                        void onCreateDesignTicketForSubtask(s).finally(() =>
                                          setSubtaskLinkAction((prev) => ({ ...prev, [s.id]: "" }))
                                        );
                                      } else if (next === "production") {
                                        void onCreateProductionTicketForSubtask(s).finally(() =>
                                          setSubtaskLinkAction((prev) => ({ ...prev, [s.id]: "" }))
                                        );
                                      }
                                    }}
                                    ariaLabel="Linked ticket actions"
                                    disabled={!profile || !isMarketingTeamProfile(profile)}
                                  >
                                    <option value="" className="bg-zinc-900">
                                      Link…
                                    </option>
                                    <option value="existing" className="bg-zinc-900">
                                      Link existing ticket
                                    </option>
                                    <option value="design" className="bg-zinc-900">
                                      Create design ticket
                                    </option>
                                    <option value="production" className="bg-zinc-900">
                                      Create production ticket
                                    </option>
                                  </PillSelect>
                                </>
                              ) : null}
                            </div>
                          )}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <div className="text-[11px] uppercase tracking-widest text-white/40">Dependencies</div>
                            {(() => {
                              const deps = subtaskDependencies[s.id] ?? [];
                              if (deps.length === 0) {
                                return <div className="text-xs text-white/45">None</div>;
                              }
                              return (
                                <div className="flex flex-wrap items-center gap-2">
                                  {deps.map((dep) => {
                                    const reason = dep.reason?.trim() || "";
                                    if (dep.blocker_task_id) {
                                      const k = dep.blocker_task_id.toLowerCase();
                                      return (
                                        <span key={dep.id} className={DEP_CHIP_CLASS} title={reason || undefined}>
                                          <span className="text-white/55">Ticket</span>
                                          <button
                                            type="button"
                                            className={TASK_LINK_CLASS}
                                            onClick={() => router.push(`/tasks/${dep.blocker_task_id}`)}
                                          >
                                            {linkedTaskTitles[k] || `${dep.blocker_task_id.slice(0, 8)}…`}
                                          </button>
                                          {canEditSubtasks ? (
                                            <button
                                              className={DEP_REMOVE_CLASS}
                                              onClick={() => onRemoveSubtaskDependency(s.id, dep.id)}
                                            >
                                              Remove
                                            </button>
                                          ) : null}
                                        </span>
                                      );
                                    }
                                    if (dep.blocker_subtask_id) {
                                      const blockerSubtask = subtasks.find((candidate) => candidate.id === dep.blocker_subtask_id) ?? null;
                                      const label = blockerSubtask?.title || `${dep.blocker_subtask_id.slice(0, 8)}…`;
                                      return (
                                        <span key={dep.id} className={DEP_CHIP_CLASS} title={reason || undefined}>
                                          <span className="text-white/55">Subtask</span>
                                          <span className="text-white/80">{label}</span>
                                          {canEditSubtasks ? (
                                            <button
                                              className={DEP_REMOVE_CLASS}
                                              onClick={() => onRemoveSubtaskDependency(s.id, dep.id)}
                                            >
                                              Remove
                                            </button>
                                          ) : null}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              );
                            })()}
                            {canEditSubtasks ? (
                              <PillSelect
                                value={subtaskDependencyAction[s.id] ?? ""}
                                onChange={(v) => {
                                  const next = (v as "" | "task" | "subtask") ?? "";
                                  setSubtaskDependencyAction((prev) => ({ ...prev, [s.id]: next }));
                                  setSubtaskDependencyPickerValue((prev) => ({ ...prev, [s.id]: "" }));
                                }}
                                ariaLabel="Dependency actions"
                                disabled={!canEditSubtasks}
                              >
                                <option value="" className="bg-zinc-900">
                                  Add dependency…
                                </option>
                                <option value="task" className="bg-zinc-900">
                                  Link ticket dependency
                                </option>
                                <option value="subtask" className="bg-zinc-900">
                                  Link subtask dependency
                                </option>
                              </PillSelect>
                            ) : null}

                            {canEditSubtasks && subtaskDependencyAction[s.id] === "subtask" ? (
                              <PillSelect
                                value={subtaskDependencyPickerValue[s.id] ?? ""}
                                onChange={(v) => {
                                  const next = (v as string) || "";
                                  setSubtaskDependencyPickerValue((prev) => ({ ...prev, [s.id]: next }));
                                  if (!next) return;
                                  void onCreateSubtaskDependency(s, "subtask", next);
                                }}
                                ariaLabel="Select blocking subtask"
                                disabled={!canEditSubtasks}
                              >
                                <option value="" className="bg-zinc-900">
                                  Select subtask…
                                </option>
                                {subtasks
                                  .filter((x) => x.id !== s.id)
                                  .map((x) => (
                                    <option key={x.id} value={x.id} className="bg-zinc-900">
                                      {x.title || `${x.id.slice(0, 8)}…`}
                                    </option>
                                  ))}
                              </PillSelect>
                            ) : null}

                            {canEditSubtasks && subtaskDependencyAction[s.id] === "task" ? (
                              <PillSelect
                                value={subtaskDependencyPickerValue[s.id] ?? ""}
                                onChange={(v) => {
                                  const next = (v as string) || "";
                                  setSubtaskDependencyPickerValue((prev) => ({ ...prev, [s.id]: next }));
                                  if (!next) return;
                                  void onCreateSubtaskDependency(s, "task", next);
                                }}
                                ariaLabel="Select blocking ticket"
                                disabled={!canEditSubtasks || dependencyTickets.length === 0}
                              >
                                <option value="" className="bg-zinc-900">
                                  {dependencyTickets.length === 0 ? "No pre-approved tickets found" : "Select ticket…"}
                                </option>
                                {dependencyTickets
                                  .filter((t) => t.id !== (s.linked_task_id ?? ""))
                                  .map((t) => (
                                    <option key={t.id} value={t.id} className="bg-zinc-900">
                                      {t.title || `${t.id.slice(0, 8)}…`}
                                    </option>
                                  ))}
                              </PillSelect>
                            ) : null}
                          </div>

                          <div className="mt-4">
                            <div className="text-[11px] uppercase tracking-widest text-white/40">Due</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <div className="w-full md:max-w-[260px]">
                                <DayDatePicker
                                  value={
                                    s.linked_task_id
                                      ? (linkedTaskDueAt[s.linked_task_id.toLowerCase()] ?? "")
                                      : (s.due_at ?? "")
                                  }
                                  onChange={(v) => onUpdateSubtask(s.id, { due_at: v || null })}
                                  placeholder="Select due date"
                                  isDisabled={!canEditSubtasks || Boolean(s.linked_task_id)}
                                  showClear={!s.linked_task_id}
                                />
                              </div>
                              {s.linked_task_id ? <div className="text-xs text-white/45">Synced from linked ticket.</div> : null}
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="text-[11px] uppercase tracking-widest text-white/40">Description</div>
                            <textarea
                              value={subtaskDrafts[s.id]?.description ?? s.description ?? ""}
                              onChange={(e) => {
                                onUpdateSubtaskDescriptionDraft(s.id, e.target.value);
                                resizeTextareaToContent(e.currentTarget, 240);
                              }}
                              disabled={!canEditSubtasks}
                              rows={2}
                              ref={(el) => {
                                if (!el) return;
                                // Ensure it sizes correctly on first render / after data loads.
                                resizeTextareaToContent(el, 240);
                              }}
                              className="mt-2 w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-white/20 transition-[height] duration-150 ease-out"
                              placeholder="What is this subtask?"
                            />
                          </div>
                        </div>
                        </details>
                    );
                    })}
                  </div>
                </div>

                <div className="my-2 h-px bg-white/10" />

                <div>
                  <div className="text-xs uppercase tracking-widest text-white/45">Attachments</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => onUploadAttachments(e.target.files)}
                    />
                    <AppButton
                      intent="secondary"
                      className="h-10 px-4"
                      onPress={() => attachmentInputRef.current?.click()}
                      isDisabled={uploadingAttachments}
                    >
                      {uploadingAttachments ? "Uploading…" : "Add files"}
                    </AppButton>
                    <div className="text-xs text-white/45">Max 50 MB per file.</div>
                  </div>
                  {attachmentsStatus ? <div className="mt-2 text-xs text-amber-200/90">{attachmentsStatus}</div> : null}
                  <div className="mt-3 space-y-2">
                    {attachments.length === 0 ? (
                      <div className="text-sm text-white/50">No attachments yet.</div>
                    ) : (
                      attachments.map((att) => {
                        const uploader = profiles.find((p) => p.id === att.uploader_id) ?? null;
                        const uploaderLabel = uploader ? toOptionLabel(uploader) : "Unknown";
                        const created = new Date(att.created_at);
                        const when = Number.isFinite(created.getTime()) ? created.toLocaleDateString() : "—";
                        const isReferenced = referencedAttachmentIds.has(att.id);
                        const canDeleteAttachment =
                          profile != null && (isMarketingManagerProfile(profile) || (att.uploader_id != null && att.uploader_id === profile.id));
                        return (
                          <div
                            key={att.id}
                            className={[
                              "glass-inset rounded-2xl border px-4 py-3",
                              isReferenced ? "border-sky-400/30 bg-sky-500/[0.08]" : "border-white/10 bg-white/[0.02]"
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white/90 truncate">{att.file_name}</div>
                                <div className="mt-1 text-xs text-white/55">
                                  {formatBytes(att.size_bytes)} · {uploaderLabel} · {when}
                                  {isReferenced ? (
                                    <span className="ml-2 inline-flex items-center rounded-full border border-sky-300/30 bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-100">
                                      Referenced
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <AppButton intent="secondary" size="sm" className="h-9 px-4" onPress={() => onDownloadAttachment(att)}>
                                  Download
                                </AppButton>
                                {canDeleteAttachment ? (
                                  <button
                                    type="button"
                                    className="h-9 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
                                    onClick={() => onDeleteAttachment(att)}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="my-2 h-px bg-white/10" />

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-white/45">Comments</div>
                      <div className="mt-2 text-sm text-white/55">Leave context for the team.</div>
                    </div>
                    <AppButton intent="secondary" size="sm" className="h-9 px-4 shrink-0" onPress={refresh}>
                      Refresh
                    </AppButton>
                  </div>
                  {commentsStatus ? <div className="mt-2 text-xs text-amber-200/90">{commentsStatus}</div> : null}

                  <div className="mt-3 space-y-2">
                    {comments.length === 0 ? (
                      <div className="text-sm text-white/45">No comments yet.</div>
                    ) : (
                      comments.map((c) => {
                        const author =
                          profiles.find((p) => p.id === c.author_id)?.full_name ||
                          profiles.find((p) => p.id === c.author_id)?.email ||
                          c.author_id.slice(0, 8) + "…";
                        const createdAt = new Date(c.created_at);
                        const updatedAt = new Date(c.updated_at);
                        const edited = Number.isFinite(updatedAt.getTime()) && updatedAt.getTime() - createdAt.getTime() > 1000;
                        const when = createdAt.toLocaleString();
                        const isEditing = editingCommentId === c.id;
                        const canEditThisComment = profile?.id != null && c.author_id === profile.id;
                        const canDeleteThisComment = profile != null && (c.author_id === profile.id || isMarketingManagerProfile(profile));
                        const mentionIdsForComment = commentMentionsByCommentId[c.id] ?? [];
                        const attachmentIdsForComment = commentAttachmentsByCommentId[c.id] ?? [];
                        return (
                          <div key={c.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm text-white/80">
                                <span className="font-semibold text-white/90">{author}</span> ·{" "}
                                <span className="text-white/50">
                                  {when}
                                  {edited ? (
                                    <span className="text-white/40" title={`Edited ${updatedAt.toLocaleString()}`}>
                                      {" "}
                                      (edited)
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                              {canEditThisComment || canDeleteThisComment ? (
                                <div className="flex items-center gap-2">
                                  {canEditThisComment && !isEditing ? (
                                    <button className="text-xs text-white/60 hover:text-white/80" onClick={() => onEditComment(c)}>
                                      Edit
                                    </button>
                                  ) : null}
                                  {canDeleteThisComment ? (
                                    <button className="text-xs text-white/60 hover:text-white/80" onClick={() => onDeleteComment(c.id)}>
                                      Delete
                                    </button>
                                  ) : null}
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
                              <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">
                                {renderCommentBody(c.body, mentionIdsForComment)}
                              </div>
                            )}
                            {attachmentIdsForComment.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {attachmentIdsForComment.map((id) => {
                                  const att = attachmentById.get(id);
                                  if (!att) return null;
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-100 hover:bg-sky-500/20"
                                      onClick={() => onDownloadAttachment(att)}
                                    >
                                      <span className="truncate max-w-[160px]">{att.file_name}</span>
                                      <span className="text-sky-200/70">{formatBytes(att.size_bytes)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4">
                    <textarea
                      value={commentBody}
                      ref={commentTextareaRef}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCommentBody(next);
                        setCommentMentionIds((prev) => syncMentionIds(next, prev));
                        updateMentionSearch(next, e.target.selectionStart ?? next.length);
                      }}
                      onKeyUp={(e) => {
                        const target = e.currentTarget;
                        updateMentionSearch(target.value, target.selectionStart ?? target.value.length);
                      }}
                      onBlur={() => {
                        setTimeout(() => setMentionOpen(false), 150);
                      }}
                      disabled={!canComment || savingComment}
                      rows={3}
                      className="w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
                      placeholder="Add a comment…"
                    />
                    {mentionOpen ? (
                      <div className="relative">
                        <div className="absolute left-0 right-0 mt-2 z-30">
                          <DropdownMenu title="Mention">
                            {(() => {
                              const matches = mentionableProfiles
                                .filter((p) => {
                                  const label = toOptionLabel(p).toLowerCase();
                                  const q = mentionQuery.trim().toLowerCase();
                                  if (!q) return true;
                                  return label.includes(q);
                                })
                                .slice(0, 6);
                              if (matches.length === 0) {
                                return <div className="px-3 py-2 text-sm text-white/50">No matches.</div>;
                              }
                              return matches.map((p) => (
                                <DropdownItem key={p.id} onClick={() => onInsertMention(p)} trailing={p.role === "cmo" ? "CMO" : ""}>
                                  {toOptionLabel(p)}
                                </DropdownItem>
                              ));
                            })()}
                          </DropdownMenu>
                        </div>
                      </div>
                    ) : null}
                    {taggedMentionLabels.length > 0 ? (
                      <div className="mt-2 text-xs text-white/60">
                        Tagged:{" "}
                        {taggedMentionLabels.map((label, idx) => (
                          <span key={`${label}-${idx}`} className="font-medium text-sky-200">
                            {label}
                            {idx < taggedMentionLabels.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="min-w-[220px]">
                        <PillSelect
                          value=""
                          onChange={(v) => {
                            const id = (v as string) || "";
                            if (!id) return;
                            setCommentAttachmentIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                          }}
                          ariaLabel="Reference attachment in comment"
                        >
                          <option value="" className="bg-zinc-900">
                            Reference attachment…
                          </option>
                          {attachments
                            .filter((a) => !commentAttachmentIds.includes(a.id))
                            .map((a) => (
                              <option key={a.id} value={a.id} className="bg-zinc-900">
                                {a.file_name}
                              </option>
                            ))}
                        </PillSelect>
                        <div className="mt-1 text-[11px] text-white/45">
                          Adds a link to an existing attachment on this ticket (doesn’t upload a file).
                        </div>
                      </div>
                      {commentAttachmentIds.map((id) => {
                        const att = attachmentById.get(id);
                        if (!att) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70"
                          >
                            <span className="truncate max-w-[180px]">{att.file_name}</span>
                            <button
                              type="button"
                              className="text-white/40 hover:text-white/70"
                              onClick={() => setCommentAttachmentIds((prev) => prev.filter((x) => x !== id))}
                              aria-label="Remove attachment"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
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
                </div>
              </div>
            </Surface>

            <Surface className="md:col-span-5">
              <div className="text-lg font-semibold text-white/90">Properties</div>
              <div className="mt-1 text-sm text-white/55">
                Notion-style fields. {canEditProperties ? "Editable for you." : "Read-only for you."}
              </div>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Priority</div>
                  {canEditProperties ? (
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
                  {canEditStatus ? (
                    <PillSelect
                      value={taskStatus}
                      onChange={(v) => onSetStatus(v as TaskStatus)}
                      ariaLabel="Status"
                      disabled={isDependencyBlocked}
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900">
                          {statusLabel(s)}
                        </option>
                      ))}
                    </PillSelect>
                  ) : (
                    <div className="text-sm text-white/80">{statusLabel(taskStatus)}</div>
                  )}
                </div>

                <div className="grid grid-cols-[130px,1fr] items-start gap-3">
                  <div className="pt-1 text-xs uppercase tracking-widest text-white/45">Dependencies</div>
                  <div className="space-y-2">
                    {taskDependencies.length === 0 ? (
                      <div className="text-sm text-white/55">None</div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {taskDependencies.map((d) => {
                          const k = d.blocker_task_id.toLowerCase();
                          const label = d.reason?.trim() || linkedTaskTitles[k] || `${d.blocker_task_id.slice(0, 8)}…`;
                          return (
                            <span key={d.id} className={DEP_CHIP_CLASS}>
                              <span className="text-white/55">Ticket</span>
                              <button type="button" className={TASK_LINK_CLASS} onClick={() => router.push(`/tasks/${d.blocker_task_id}`)}>
                                {label}
                              </button>
                              {canEditStatus ? (
                                <button className={DEP_REMOVE_CLASS} onClick={() => onRemoveTaskDependency(d.id)}>
                                  Remove
                                </button>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {canEditStatus && !linkedParentSubtask?.task_id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <PillSelect
                          value={taskDependencyPickerValue}
                          onChange={(v) => {
                            const next = (v as string) || "";
                            setTaskDependencyPickerValue(next);
                            if (!next) return;
                            void onCreateTaskDependency(next);
                          }}
                          ariaLabel="Add dependency ticket"
                          disabled={dependencyTickets.length === 0}
                        >
                          <option value="" className="bg-zinc-900">
                            {dependencyTickets.length === 0 ? "No pre-approved tickets found" : "Add ticket dependency…"}
                          </option>
                          {dependencyTickets
                            .filter((t) => t.id !== taskId)
                            .map((t) => (
                              <option key={t.id} value={t.id} className="bg-zinc-900">
                                {t.title || `${t.id.slice(0, 8)}…`}
                              </option>
                            ))}
                        </PillSelect>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Assignee</div>
                  {canEditProperties ? (
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
                  {canEditProperties ? (
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
                  {canEditProperties ? (
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
                      <div className="text-sm text-white/80">
                        {approvalState === "not_required"
                          ? approvalLabel(approvalState)
                          : approvalState === "approved"
                            ? "Approved"
                            : taskStatus === "submitted"
                              ? "Pending approval"
                              : "Not submitted"}
                      </div>
                      {canApprove && approvalState === "pending" && taskStatus === "submitted" ? (
                        <AppButton
                          intent="primary"
                          size="sm"
                          className="h-9 px-4"
                          onPress={onApproveTask}
                          isDisabled={!canComment || !canApprove || (!approverUserId && !isCmo)}
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
                  <div className="text-xs uppercase tracking-widest text-white/45">Master</div>
                  {canEditProperties ? (
                    <PillSelect
                      value={masterCalendarTag}
                      onChange={(v) => setMasterCalendarTag(v as TaskMasterCalendarTag | "")}
                      ariaLabel="Master calendar tag"
                    >
                      <option value="" className="bg-zinc-900">
                        None
                      </option>
                      <option value="marketing" className="bg-zinc-900">
                        Marketing
                      </option>
                      <option value="sales" className="bg-zinc-900">
                        Sales
                      </option>
                      <option value="design" className="bg-zinc-900">
                        Design & Production
                      </option>
                    </PillSelect>
                  ) : (
                    <div className="text-sm text-white/80">
                      {masterCalendarTag === "marketing"
                        ? "Marketing"
                        : masterCalendarTag === "sales"
                          ? "Sales"
                          : masterCalendarTag === "design"
                            ? "Design & Production"
                            : "None"}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-[130px,1fr] items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-white/45">Due</div>
                  {canEditProperties ? (
                    <DayDatePicker value={dueAt} onChange={setDueAt} placeholder="Select due date" isDisabled={!canEditProperties} showClear />
                  ) : (
                    <div className="text-sm text-white/80">{dueAt || "—"}</div>
                  )}
                </div>

                {teams.length === 0 ? <div className="text-xs text-white/45">No teams configured yet. Ask the CMO to set them up.</div> : null}
              </div>

              <div className="my-4 h-px bg-white/10" />

              <div className="text-sm font-semibold text-white/85">Contributors</div>
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

              <div className="my-4 h-px bg-white/10" />

              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold text-white/90">Activity</div>
                  <div className="mt-1 text-sm text-white/55">Latest updates. Expand when needed.</div>
                </div>
                {events.length > 6 ? (
                  <button className="text-xs text-white/60 hover:text-white/80" onClick={() => setShowAllActivity((v) => !v)}>
                    {showAllActivity ? "Show less" : `Show all (${events.length})`}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                {events.length === 0 ? (
                  <div className="text-sm text-white/45">No activity yet.</div>
                ) : (
                  (showAllActivity ? events : events.slice(0, 6)).map((e) => {
                    const who =
                      profiles.find((p) => p.id === e.actor_id)?.full_name ||
                      profiles.find((p) => p.id === e.actor_id)?.email ||
                      (e.actor_id ? e.actor_id.slice(0, 8) + "…" : "Someone");
                    const when = new Date(e.created_at).toLocaleString();
                    const isCommentEvent = e.type === "comment_edited" || e.type === "comment_deleted";
                    const isDescriptionEvent = e.type === "description_edited";
                    const resolveProfileLabel = (value: string | null | undefined, fallback = "Someone") => {
                      if (!value) return fallback;
                      const p = profiles.find((x) => x.id === value) ?? null;
                      return p ? toOptionLabel(p) : `${value.slice(0, 8)}…`;
                    };
                    const commentAuthorId = isCommentEvent ? e.from_value : null;
                    const commentAuthorLabel = commentAuthorId ? resolveProfileLabel(commentAuthorId) : "";
                    const commentTarget =
                      commentAuthorId && e.actor_id && commentAuthorId === e.actor_id
                        ? "their comment"
                        : commentAuthorLabel
                          ? `${commentAuthorLabel}'s comment`
                          : "comment";
                    const commentVerb = e.type === "comment_deleted" ? "Deleted" : "Edited";
                    const typeLabel =
                      e.type === "created"
                        ? "Created"
                        : e.type === "status"
                          ? "Status"
                          : e.type === "assignee"
                            ? "Assignee"
                            : e.type === "approval"
                              ? "Approval"
                              : e.type === "priority"
                                ? "Priority"
                                : e.type === "due_at"
                                  ? "Due"
                        : e.type === "description_edited"
                          ? "Description edited"
                                  : e.type === "comment_edited"
                                    ? "Comment edited"
                                    : e.type === "comment_deleted"
                                      ? "Comment deleted"
                                  : e.type;

                    function formatEventValue(value: string | null) {
                      if (!value) {
                        if (e.type === "assignee") return "Unassigned";
                        if (e.type === "due_at") return "No due date";
                        return "—";
                      }
                      if (e.type === "assignee") {
                        const p = profiles.find((x) => x.id === value) ?? null;
                        return p ? toOptionLabel(p) : `${value.slice(0, 8)}…`;
                      }
                      if (e.type === "status") return statusLabel(value as TaskStatus);
                      if (e.type === "approval") return approvalLabel(value as TaskApprovalState);
                      if (e.type === "priority") return priorityLabel(value as TaskPriority);
                      if (e.type === "due_at") return value;
                      return value;
                    }

                    const fromLabel = e.from_value != null ? formatEventValue(e.from_value) : "";
                    const toLabel = e.to_value != null ? formatEventValue(e.to_value) : "";
                    const arrow = e.from_value != null || e.to_value != null ? " → " : "";
                    return (
                      <div key={e.id} className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <div className="text-sm text-white/80">
                          <span className="font-semibold text-white/90">{who}</span> · <span className="text-white/50">{when}</span>
                        </div>
                        <div className="mt-1 text-sm text-white/70">
                          {isCommentEvent ? (
                            <span className="text-white/85">
                              {commentVerb} {commentTarget}
                            </span>
                          ) : isDescriptionEvent ? (
                            <span className="text-white/85">Edited the description of this ticket</span>
                          ) : (
                            <>
                              {typeLabel}
                              {fromLabel || toLabel ? (
                                <>
                                  {" "}
                                  <span className="text-white/60">{fromLabel}</span>
                                  {arrow}
                                  <span className="text-white/85">{toLabel}</span>
                                </>
                              ) : null}
                            </>
                          )}
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

