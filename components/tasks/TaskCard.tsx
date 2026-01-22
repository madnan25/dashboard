"use client";

import type { Profile, Project, Task, TaskTeam } from "@/lib/dashboardDb";

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

export function TaskCard({
  task,
  assignee,
  project,
  team,
  onOpen,
  onHover,
  disableOpen
}: {
  task: Task;
  assignee: Profile | null;
  project: Project | null;
  team?: TaskTeam | null;
  onOpen: () => void;
  onHover?: () => void;
  disableOpen?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (disableOpen) return;
        onOpen();
      }}
      onMouseEnter={onHover}
      className="w-full text-left select-none glass-inset rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.03] hover:border-white/15 transition-colors px-4 py-3 cursor-pointer"
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
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${pillClass(task.priority)}`}>
            {task.priority.toUpperCase()}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${approvalPill(task.approval_state)}`}
          >
            {task.approval_state === "approved"
              ? "Approved"
              : task.approval_state === "pending"
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

