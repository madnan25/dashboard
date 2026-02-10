"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/dashboardDb";
import { taskIsOpen } from "@/components/tasks/taskModel";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(y: number, mIndex: number, d: number) {
  // mIndex is 0-11
  return `${y}-${pad2(mIndex + 1)}-${pad2(d)}`;
}

function fmtDayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday}, ${month} ${d}, ${y}`;
}

function mondayFirstIndex(jsDay: number) {
  // JS: 0=Sun..6=Sat -> Monday=0..Sunday=6
  return (jsDay + 6) % 7;
}

function priorityClass(p: Task["priority"]) {
  switch (p) {
    case "p0":
      return "bg-rose-500/15 text-rose-200 border-rose-500/20 hover:bg-rose-500/20";
    case "p1":
      return "bg-amber-500/15 text-amber-200 border-amber-500/20 hover:bg-amber-500/20";
    case "p2":
      return "bg-sky-500/15 text-sky-200 border-sky-500/20 hover:bg-sky-500/20";
    case "p3":
      return "bg-white/[0.04] text-white/80 border-white/10 hover:bg-white/[0.06]";
  }
}

export function TasksCalendar(props: {
  tasks: Task[];
  year: number;
  monthIndex: number; // 0-11
  onOpenTask: (task: Task) => void;
  canEditDueForTask: (task: Task) => boolean;
  onMoveTaskDue: (taskId: string, dueAt: string | null) => Promise<void> | void;
  outOfSyncTaskIds?: Set<string>;
}) {
  const { tasks, year, monthIndex, onOpenTask, canEditDueForTask, onMoveTaskDue, outOfSyncTaskIds } = props;
  const isOutOfSync = useCallback(
    (id: string) => Boolean(outOfSyncTaskIds && outOfSyncTaskIds.has(id.toLowerCase())),
    [outOfSyncTaskIds]
  );
  const [dragOverIso, setDragOverIso] = useState<string>("");
  const [dragOverNoDue, setDragOverNoDue] = useState(false);
  const [draggingId, setDraggingId] = useState<string>("");
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);

  const daysInMonth = useMemo(() => new Date(year, monthIndex + 1, 0).getDate(), [monthIndex, year]);
  const firstDay = useMemo(() => new Date(year, monthIndex, 1), [monthIndex, year]);
  const leadingBlanks = useMemo(() => mondayFirstIndex(firstDay.getDay()), [firstDay]);
  const todayIso = useMemo(() => {
    const d = new Date();
    return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const tasksByDue = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!taskIsOpen(t)) continue;
      if (!t.due_at) continue;
      const key = t.due_at;
      const cur = map.get(key) ?? [];
      cur.push(t);
      map.set(key, cur);
    }
    // stable sort by priority then updated_at
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const p = (x: Task["priority"]) => (x === "p0" ? 0 : x === "p1" ? 1 : x === "p2" ? 2 : 3);
        const dp = p(a.priority) - p(b.priority);
        if (dp !== 0) return dp;
        return (b.updated_at || "").localeCompare(a.updated_at || "");
      });
      map.set(k, arr);
    }
    return map;
  }, [tasks]);

  const noDue = useMemo(() => tasks.filter((t) => taskIsOpen(t) && !t.due_at), [tasks]);

  const selectedDayTasks = useMemo(() => {
    if (!selectedDayIso) return [];
    return tasksByDue.get(selectedDayIso) ?? [];
  }, [selectedDayIso, tasksByDue]);

  useEffect(() => {
    if (!selectedDayIso) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedDayIso(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedDayIso]);

  const outOfSyncCount = useMemo(() => {
    if (!outOfSyncTaskIds || outOfSyncTaskIds.size === 0) return 0;
    let n = 0;
    for (const t of tasks) {
      if (!taskIsOpen(t)) continue;
      if (isOutOfSync(t.id)) n++;
    }
    return n;
  }, [isOutOfSync, outOfSyncTaskIds, tasks]);

  const dayCells = useMemo(() => {
    const cells: Array<{ iso: string; day: number; inMonth: boolean } | null> = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: isoDate(year, monthIndex, d), day: d, inMonth: true });
    // Pad to full weeks (usually 35/42)
    while (cells.length % 7 !== 0) cells.push(null);
    if (cells.length < 35) while (cells.length < 35) cells.push(null);
    return cells;
  }, [daysInMonth, leadingBlanks, monthIndex, year]);

  return (
    <div className="grid gap-6 md:grid-cols-12">
      <div className="md:col-span-10">
        {outOfSyncCount > 0 ? (
          <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-200/90">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[11px] font-bold text-rose-200">
              !
            </span>{" "}
            <span className="font-semibold">{outOfSyncCount} ticket(s)</span> need due date correction (child due date is after parent ticket due date).
          </div>
        ) : null}

        <div className="grid grid-cols-7 gap-3 text-xs text-white/50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-1">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-3">
          {dayCells.map((cell, idx) => {
            if (!cell) {
              return <div key={idx} className="h-40 rounded-2xl border border-white/5 bg-white/[0.01]" />;
            }
            const items = tasksByDue.get(cell.iso) ?? [];
            const isToday = cell.iso === todayIso;
            const show = items.slice(0, 4);
            const more = items.length - show.length;
            const isDrop = dragOverIso === cell.iso;
            const hasOutOfSync = items.some((t) => isOutOfSync(t.id));

            return (
              <div
                key={cell.iso}
                className={[
                  "relative h-40 rounded-2xl border bg-white/[0.02] p-3 overflow-hidden",
                  isDrop ? "border-emerald-400/40 bg-emerald-500/[0.06]" : isToday ? "border-sky-400/30 bg-sky-500/[0.06]" : "border-white/10"
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverNoDue(false);
                  setDragOverIso(cell.iso);
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={() => {
                  setDragOverIso((cur) => (cur === cell.iso ? "" : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("text/task-id");
                  setDragOverIso("");
                  setDraggingId("");
                  if (!taskId) return;
                  void onMoveTaskDue(taskId, cell.iso);
                }}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => (items.length > 0 ? setSelectedDayIso(cell.iso) : null)}
                    className={[
                      "text-xs font-semibold rounded-md px-1 py-0.5 -ml-1 transition-colors",
                      items.length > 0 ? "hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30" : "",
                      isToday ? "text-sky-200" : "text-white/70"
                    ].join(" ")}
                    title={items.length > 0 ? `Open ${fmtDayLabel(cell.iso)}` : undefined}
                  >
                    {cell.day}
                  </button>
                  {items.length > 0 ? (
                    <div className="flex items-center gap-2 text-[11px] text-white/45">
                      {hasOutOfSync ? (
                        <span
                          title="Due date correction needed"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-500/25 bg-rose-500/15 text-[11px] font-bold text-rose-200/90"
                        >
                          !
                        </span>
                      ) : null}
                      <span>{items.length}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1.5">
                  {show.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={
                        (isOutOfSync(t.id) ? "Due date course-correct needed (after parent ticket due date). " : "") + (t.title || "")
                      }
                      onClick={() => onOpenTask(t)}
                      className={[
                        "w-full text-left truncate rounded-xl border px-2 py-1 text-[12px] transition",
                        draggingId === t.id ? "opacity-50" : "",
                        isOutOfSync(t.id) ? "ring-1 ring-rose-400/40 border-rose-500/20" : "",
                        priorityClass(t.priority)
                      ].join(" ")}
                      draggable={canEditDueForTask(t)}
                      onDragStart={(e) => {
                        if (!canEditDueForTask(t)) return;
                        setDraggingId(t.id);
                        e.dataTransfer.setData("text/task-id", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingId("");
                        setDragOverIso("");
                        setDragOverNoDue(false);
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isOutOfSync(t.id) ? (
                          <span
                            aria-label="Due date correction needed"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-200"
                          >
                            !
                          </span>
                        ) : null}
                        <span className="truncate">{t.title}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {more > 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14">
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to bottom, rgba(10,12,20,0), rgba(10,12,20,0.70), rgba(10,12,20,0.92))"
                      }}
                    />
                    <div className="pointer-events-auto absolute bottom-2 left-3 right-3 flex items-center justify-between">
                      <div className="text-[11px] text-white/45">+{more} more</div>
                      <button
                        type="button"
                        onClick={() => setSelectedDayIso(cell.iso)}
                        className="text-[11px] font-medium text-white/70 hover:text-white/90 underline underline-offset-2 decoration-white/20 hover:decoration-white/60"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={[
          "md:col-span-2",
          dragOverNoDue ? "rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.05] p-3" : ""
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverIso("");
          setDragOverNoDue(true);
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => setDragOverNoDue(false)}
        onDrop={(e) => {
          e.preventDefault();
          const taskId = e.dataTransfer.getData("text/task-id");
          setDragOverNoDue(false);
          setDraggingId("");
          if (!taskId) return;
          void onMoveTaskDue(taskId, null);
        }}
      >
        <div className="text-xs uppercase tracking-widest text-white/45">No due date</div>
        <div className="mt-2 space-y-2">
          {noDue.length === 0 ? <div className="text-sm text-white/45">Nothing open.</div> : null}
          {noDue.slice(0, 12).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTask(t)}
              className="w-full text-left glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/85 hover:bg-white/[0.04]"
              draggable={canEditDueForTask(t)}
              onDragStart={(e) => {
                if (!canEditDueForTask(t)) return;
                setDraggingId(t.id);
                e.dataTransfer.setData("text/task-id", t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDraggingId("");
                setDragOverIso("");
                setDragOverNoDue(false);
              }}
            >
              <div className="truncate font-semibold text-white/90">{t.title}</div>
              <div className="mt-0.5 text-xs text-white/50">Priority {t.priority.toUpperCase()}</div>
            </button>
          ))}
          {noDue.length > 12 ? <div className="text-xs text-white/45">+{noDue.length - 12} more</div> : null}
        </div>
      </div>

      {selectedDayIso ? (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={`Tasks due ${selectedDayIso}`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setSelectedDayIso(null)}
            aria-label="Close"
          />
          <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-2xl rounded-3xl border border-white/10 bg-[rgba(18,23,40,0.96)] shadow-[0_18px_70px_rgba(0,0,0,0.55)]"
              style={{ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
            >
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <div className="text-sm font-semibold text-white/90">{fmtDayLabel(selectedDayIso)}</div>
                  <div className="mt-1 text-xs text-white/55">{selectedDayTasks.length} ticket(s) due</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayIso(null)}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.04] hover:text-white/85"
                >
                  Close
                </button>
              </div>

              <div className="px-5 pb-5 pt-4">
                {selectedDayTasks.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55">
                    No open tickets due that day.
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-auto pr-1 space-y-2">
                    {selectedDayTasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        title={
                          (isOutOfSync(t.id) ? "Due date course-correct needed (after parent ticket due date). " : "") + (t.title || "")
                        }
                        onClick={() => {
                          onOpenTask(t);
                          setSelectedDayIso(null);
                        }}
                        className={[
                          "w-full text-left rounded-2xl border px-3 py-2 text-sm transition",
                          isOutOfSync(t.id) ? "ring-1 ring-rose-400/40 border-rose-500/20" : "border-white/10",
                          priorityClass(t.priority)
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {isOutOfSync(t.id) ? (
                                <span
                                  aria-label="Due date correction needed"
                                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-200"
                                >
                                  !
                                </span>
                              ) : null}
                              <div className="truncate font-semibold text-white/90">{t.title}</div>
                            </div>
                            <div className="mt-1 text-[11px] text-white/55">Priority {t.priority.toUpperCase()}</div>
                          </div>
                          <div className="shrink-0 text-[11px] text-white/45">Open</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

