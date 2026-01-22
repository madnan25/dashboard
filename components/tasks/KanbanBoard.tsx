"use client";

import { useMemo, useState } from "react";
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
  onOpenTask,
  canMoveToStatus,
  onMoveTask
}: {
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  teams: TaskTeam[];
  onOpenTask: (t: Task) => void;
  canMoveToStatus: (task: Task, next: TaskStatus) => { ok: boolean; reason?: string };
  onMoveTask: (task: Task, next: TaskStatus) => Promise<void>;
}) {
  const router = useRouter();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const s of [...PRIMARY_FLOW, ...SIDE_LANE]) map.set(s, []);
    for (const t of tasks) {
      const arr = map.get(t.status) ?? [];
      arr.push(t);
      map.set(t.status, arr);
    }
    return map;
  }, [tasks]);

  const assigneeFor = (t: Task) => profiles.find((p) => p.id === t.assignee_id) ?? null;
  const projectFor = (t: Task) => projects.find((p) => p.id === t.project_id) ?? null;
  const teamFor = (t: Task) => teams.find((team) => team.id === t.team_id) ?? null;

  const columns = [...PRIMARY_FLOW, ...SIDE_LANE];

  function onDragStart(e: React.DragEvent, t: Task) {
    e.dataTransfer.setData("text/plain", t.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(t.id);
    setDragOverStatus(null);

    // Avoid expensive ghost previews that make drag feel laggy.
    try {
      const img = new Image();
      img.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="; // 1x1 transparent
      e.dataTransfer.setDragImage(img, 0, 0);
    } catch {
      // ignore
    }
  }

  function onDragEnd() {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  }

  function onDropToStatus(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const chk = canMoveToStatus(t, status);
    if (!chk.ok) return;
    if (t.status === status) return;
    void onMoveTask(t, status);
    setDraggingTaskId(null);
    setDragOverStatus(null);
  }

  const draggingTask = draggingTaskId ? tasks.find((t) => t.id === draggingTaskId) ?? null : null;

  return (
    <div className="mt-4">
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
        {columns.map((s) => {
          const col = byStatus.get(s) ?? [];
          const isOver = dragOverStatus === s;
          const canDropHere = draggingTask ? canMoveToStatus(draggingTask, s).ok : false;
          return (
            <div key={s} className="min-w-[280px] w-[280px]">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-white/45">{statusLabel(s)}</div>
                <div className="text-xs text-white/45 tabular-nums">{col.length}</div>
              </div>
              <div
                className={[
                  "space-y-2 min-h-[72px] rounded-2xl p-1 transition-colors",
                  isOver && canDropHere ? "bg-white/[0.04] ring-1 ring-white/10" : "",
                  isOver && draggingTask && !canDropHere ? "bg-red-500/[0.06] ring-1 ring-red-400/20" : ""
                ].join(" ")}
                onDragEnter={() => {
                  if (!draggingTaskId) return;
                  setDragOverStatus(s);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!draggingTask) {
                    e.dataTransfer.dropEffect = "none";
                    return;
                  }
                  const ok = canMoveToStatus(draggingTask, s).ok;
                  e.dataTransfer.dropEffect = ok ? "move" : "none";
                  setDragOverStatus(s);
                }}
                onDrop={(e) => onDropToStatus(e, s)}
              >
                {col.length === 0 ? (
                  <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.01] px-4 py-3 text-sm text-white/35">
                    Empty
                  </div>
                ) : (
                  col.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, t)}
                      onDragEnd={onDragEnd}
                      title={canMoveToStatus(t, s).ok ? "Drag to move" : canMoveToStatus(t, s).reason || ""}
                    >
                      <TaskCard
                        task={t}
                        assignee={assigneeFor(t)}
                        project={projectFor(t)}
                        team={teamFor(t)}
                        onOpen={() => onOpenTask(t)}
                        onHover={() => router.prefetch(`/tasks/${t.id}`)}
                        disableOpen={draggingTaskId != null}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-white/40">
        Tip: scroll horizontally to move across the belt. Tap a card to update status/owner/stamp.
      </div>
    </div>
  );
}

