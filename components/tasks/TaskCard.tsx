"use client";

import type { Profile, Project, Task, TaskSubtask, TaskTeam } from "@/lib/dashboardDb";

function pillClass(kind: "p0" | "p1" | "p2" | "p3") {
  switch (kind) {
    case "p0":
      return "bg-red-500/20 border-red-400/20 text-red-100";
    case "p1":
      return "bg-amber-500/20 border-amber-400/20 text-amber-100";
    case "p2":
      return "bg-sky-500/15 border-sky-400/20 text-sky-100";
    case "p3":
      return "bg-white/[0.06] border-white/10 text-white/70";
  }
}

function approvalPill(approval: Task["approval_state"]) {
  switch (approval) {
    case "approved":
      return "bg-emerald-500/15 border-emerald-400/20 text-emerald-100";
    case "pending":
      return "bg-fuchsia-500/12 border-fuchsia-400/20 text-fuchsia-100";
    case "not_required":
      return "bg-white/[0.06] border-white/10 text-white/70";
  }
}

function subtaskIndicatorTone(
  statuses: Array<TaskSubtask["status"]>
): "purple" | "green" | "red" | "yellow" {
  if (statuses.some((s) => s === "blocked")) return "red";
  if (statuses.some((s) => s === "on_hold")) return "yellow";
  if (statuses.length > 0 && statuses.every((s) => s === "done")) return "green";
  return "purple";
}

function subtaskPillClass(tone: "purple" | "green" | "red" | "yellow") {
  switch (tone) {
    case "green":
      return {
        wrap: "border-emerald-400/25 bg-emerald-500/[0.10] text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.12)]",
        dot: "bg-emerald-200/90 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
      };
    case "yellow":
      return {
        wrap: "border-amber-400/25 bg-amber-500/[0.10] text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.12)]",
        dot: "bg-amber-200/90 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
      };
    case "red":
      return {
        wrap: "border-rose-400/25 bg-rose-500/[0.10] text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.12)]",
        dot: "bg-rose-200/90 shadow-[0_0_10px_rgba(244,63,94,0.35)]"
      };
    case "purple":
    default:
      return {
        wrap: "border-fuchsia-400/25 bg-fuchsia-500/[0.10] text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.12)]",
        dot: "bg-fuchsia-200/90 shadow-[0_0_10px_rgba(217,70,239,0.35)]"
      };
  }
}

export function TaskCard({
  task,
  assignee,
  project,
  team,
  subtaskAssignments,
  onOpen,
  onHover,
  disableOpen,
  className
}: {
  task: Task;
  assignee: Profile | null;
  project: Project | null;
  team?: TaskTeam | null;
  subtaskAssignments?: Array<Pick<TaskSubtask, "id" | "title" | "status">>;
  onOpen: () => void;
  onHover?: () => void;
  disableOpen?: boolean;
  className?: string;
}) {
  const effectiveApproval: Task["approval_state"] = task.status === "approved" ? "approved" : task.approval_state;
  const assignedViaSubtask = subtaskAssignments && subtaskAssignments.length > 0 ? subtaskAssignments : null;
  const subtaskTone = assignedViaSubtask ? subtaskIndicatorTone(assignedViaSubtask.map((s) => s.status)) : null;
  const subtaskClasses = subtaskTone ? subtaskPillClass(subtaskTone) : null;
  return (
    <button
      type="button"
      onClick={() => {
        if (disableOpen) return;
        onOpen();
      }}
      onMouseEnter={onHover}
      className={[
        "w-full text-left select-none glass-inset rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.03] hover:border-white/15 transition-colors px-4 py-3 cursor-pointer",
        className || ""
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white/90 leading-snug break-words">{task.title}</div>
          <div className="mt-1 text-xs text-white/55">
            {assignee ? (
              <span>
                With <span className="text-white/75">{assignee.full_name || assignee.email || "Unassigned"}</span>
              </span>
            ) : (
              <span className="text-white/50">Unassigned</span>
            )}
            {project ? <span className="ml-2 text-white/45">· {project.name}</span> : null}
            {team ? <span className="ml-2 text-white/45">· {team.name}</span> : null}
          </div>
          {assignedViaSubtask ? (
            <div className="mt-2">
              <span
                className={[
                  "inline-flex max-w-full items-center gap-2 rounded-full border px-2 py-0.5 text-[11px]",
                  subtaskClasses?.wrap || ""
                ].join(" ")}
              >
                <span className={["h-1.5 w-1.5 rounded-full", subtaskClasses?.dot || ""].join(" ")} />
                <span className="shrink-0 tracking-wide">Subtask</span>
                <span className="text-white/40">·</span>
                <span className="min-w-0 truncate">
                  {assignedViaSubtask.length === 1
                    ? assignedViaSubtask[0].title
                    : `${assignedViaSubtask.length} assigned`}
                </span>
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${pillClass(task.priority)}`}>
            {task.priority.toUpperCase()}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${approvalPill(effectiveApproval)}`}
          >
            {effectiveApproval === "approved"
              ? "Approved"
              : effectiveApproval === "pending"
                ? "Pending"
                : "No approval"}
          </span>
        </div>
      </div>

      {task.due_at ? (
        <div className="mt-2 text-xs text-white/55">
          Due: <span className="text-white/75 tabular-nums">{task.due_at}</span>
        </div>
      ) : null}
    </button>
  );
}

