"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";
import type { Profile, Project, Task, TaskStatus, TaskTeam } from "@/lib/dashboardDb";
import { PRIMARY_FLOW, SIDE_LANE, statusLabel } from "@/components/tasks/taskModel";
import { TaskCard } from "@/components/tasks/TaskCard";

export function KanbanBoard({
  tasks,
  profiles,
  projects,
  teams,
  subtaskAssignmentsByTaskId,
  onOpenTask,
  canMoveToStatus,
  onMoveTask
}: {
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  teams: TaskTeam[];
  subtaskAssignmentsByTaskId?: Record<
    string,
    Array<{ id: string; title: string; status: "not_done" | "done" | "blocked" | "on_hold"; due_at: string | null }>
  >;
  onOpenTask: (t: Task) => void;
  canMoveToStatus: (task: Task, next: TaskStatus) => { ok: boolean; reason?: string };
  onMoveTask: (task: Task, next: TaskStatus) => Promise<void>;
}) {
  const router = useRouter();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [draggingActive, setDraggingActive] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);
  const [closedCollapsed, setClosedCollapsed] = useState(true);
  const dragRef = useRef<{
    taskId: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    originalStatus: TaskStatus;
  } | null>(null);

  const columns = useMemo(() => {
    // Keep Closed at the very end, after the side lane.
    const primaryNoClosed = PRIMARY_FLOW.filter((s) => s !== "closed");
    return [...primaryNoClosed, ...SIDE_LANE, "closed"] as TaskStatus[];
  }, []);

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const s of columns) map.set(s, []);
    for (const t of tasks) {
      const arr = map.get(t.status) ?? [];
      arr.push(t);
      map.set(t.status, arr);
    }
    return map;
  }, [columns, tasks]);

  const assigneeFor = (t: Task) => profiles.find((p) => p.id === t.assignee_id) ?? null;
  const projectFor = (t: Task) => projects.find((p) => p.id === t.project_id) ?? null;
  const teamFor = (t: Task) => teams.find((team) => team.id === t.team_id) ?? null;

  function onPointerDown(e: React.PointerEvent, t: Task) {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      taskId: t.id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      originalStatus: t.status
    };
    setDraggingTaskId(t.id);
    setDraggingActive(false);
    setDragOverStatus(null);
    setDragSize({ width: rect.width, height: rect.height });
    setDragPosition({ x: rect.left, y: rect.top });

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
  }

  function onPointerMove(e: PointerEvent) {
    const state = dragRef.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 4) {
      return;
    }
    if (!state.moved) {
      state.moved = true;
      setDraggingActive(true);
    }

    setDragPosition({ x: e.clientX - state.offsetX, y: e.clientY - state.offsetY });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const column = el?.closest?.("[data-task-status]") as HTMLElement | null;
    const status = (column?.dataset?.taskStatus as TaskStatus | undefined) ?? null;
    setDragOverStatus(status);
  }

  function onPointerUp(e: PointerEvent) {
    const state = dragRef.current;
    dragRef.current = null;
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    const taskId = state?.taskId ?? null;
    const moved = state?.moved ?? false;
    const t = taskId ? tasks.find((x) => x.id === taskId) ?? null : null;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const column = el?.closest?.("[data-task-status]") as HTMLElement | null;
    const dropStatus = (column?.dataset?.taskStatus as TaskStatus | undefined) ?? null;

    setDraggingTaskId(null);
    setDraggingActive(false);
    setDragPosition(null);
    setDragSize(null);

    if (!t || !state) {
      setDragOverStatus(null);
      return;
    }

    if (!moved) {
      onOpenTask(t);
      setDragOverStatus(null);
      return;
    }

    if (dropStatus && dropStatus !== state.originalStatus) {
      const chk = canMoveToStatus(t, dropStatus);
      if (chk.ok) void onMoveTask(t, dropStatus);
    }
    setDragOverStatus(null);
  }

  const draggingTask = draggingTaskId ? tasks.find((t) => t.id === draggingTaskId) ?? null : null;

  return (
    <div className="mt-4">
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
        {columns.map((s) => {
          const col = byStatus.get(s) ?? [];
          const isOver = draggingActive && dragOverStatus === s;
          const canDropHere = draggingTask ? canMoveToStatus(draggingTask, s).ok : false;
          const isClosed = s === "closed";
          const isCollapsed = isClosed && closedCollapsed;
          return (
            <div key={s} className={isCollapsed ? "min-w-[160px] w-[160px]" : "min-w-[280px] w-[280px]"}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-widest text-white/45">{statusLabel(s)}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-white/45 tabular-nums">{col.length}</div>
                  {isClosed ? (
                    <button
                      type="button"
                      className="text-[11px] text-white/60 hover:text-white/80 underline underline-offset-2 decoration-white/20 hover:decoration-white/40"
                      onClick={() => setClosedCollapsed((v) => !v)}
                      title={closedCollapsed ? "Show closed tickets" : "Hide closed tickets"}
                    >
                      {closedCollapsed ? "Show" : "Hide"}
                    </button>
                  ) : null}
                </div>
              </div>
              <div
                className={[
                  "space-y-2 min-h-[72px] rounded-2xl p-1 transition-colors",
                  isOver && canDropHere ? "bg-white/[0.04] ring-1 ring-white/10" : "",
                  isOver && draggingTask && !canDropHere ? "bg-red-500/[0.06] ring-1 ring-red-400/20" : ""
                ].join(" ")}
                data-task-status={s}
              >
                {isCollapsed ? (
                  <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.01] px-4 py-3 text-sm text-white/45">
                    Collapsed
                    <div className="mt-1 text-xs text-white/40">Tap “Show” to view.</div>
                  </div>
                ) : col.length === 0 ? (
                  <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.01] px-4 py-3 text-sm text-white/35">
                    Empty
                  </div>
                ) : (
                  col.map((t) => (
                    <div
                      key={t.id}
                      onPointerDown={(e) => onPointerDown(e, t)}
                      title={canMoveToStatus(t, s).ok ? "Drag to move" : canMoveToStatus(t, s).reason || ""}
                    >
                      <TaskCard
                        task={t}
                        assignee={assigneeFor(t)}
                        project={projectFor(t)}
                        team={teamFor(t)}
                        subtaskAssignments={subtaskAssignmentsByTaskId?.[t.id] ?? undefined}
                        onOpen={() => onOpenTask(t)}
                        onHover={() => router.prefetch(`/tasks/${t.id}`)}
                        disableOpen={draggingTaskId != null}
                        className="cursor-grab active:cursor-grabbing"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      {draggingTask && draggingActive && dragPosition && dragSize ? (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
            width: dragSize.width,
            height: dragSize.height
          }}
        >
          <div className="scale-[1.02] opacity-95 shadow-2xl">
            <TaskCard
              task={draggingTask}
              assignee={assigneeFor(draggingTask)}
              project={projectFor(draggingTask)}
              team={teamFor(draggingTask)}
              subtaskAssignments={subtaskAssignmentsByTaskId?.[draggingTask.id] ?? undefined}
              onOpen={() => null}
              disableOpen
              className="cursor-grabbing"
            />
          </div>
        </div>
      ) : null}
      <div className="mt-2 text-xs text-white/40">
        Tip: scroll horizontally to move across the belt. Tap a card to update status/owner/stamp.
      </div>
    </div>
  );
}

