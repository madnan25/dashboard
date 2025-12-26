"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Project, Task, TaskStatus } from "@/lib/dashboardDb";
import { PRIMARY_FLOW, SIDE_LANE, statusLabel } from "@/components/tasks/taskModel";
import { TaskCard } from "@/components/tasks/TaskCard";

export function KanbanBoard({
  tasks,
  profiles,
  projects,
  onOpenTask
}: {
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  onOpenTask: (t: Task) => void;
}) {
  const router = useRouter();
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

  const columns = [...PRIMARY_FLOW, ...SIDE_LANE];

  return (
    <div className="mt-4">
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
        {columns.map((s) => {
          const col = byStatus.get(s) ?? [];
          return (
            <div key={s} className="min-w-[280px] w-[280px]">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-white/45">{statusLabel(s)}</div>
                <div className="text-xs text-white/45 tabular-nums">{col.length}</div>
              </div>
              <div className="space-y-2">
                {col.length === 0 ? (
                  <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.01] px-4 py-3 text-sm text-white/35">
                    Empty
                  </div>
                ) : (
                  col.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      assignee={assigneeFor(t)}
                      project={projectFor(t)}
                      onOpen={() => onOpenTask(t)}
                      onHover={() => router.prefetch(`/tasks/${t.id}`)}
                    />
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

