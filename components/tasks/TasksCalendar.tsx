"use client";

import { useMemo } from "react";
import type { Task } from "@/lib/dashboardDb";
import { taskIsOpen } from "@/components/tasks/taskModel";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(y: number, mIndex: number, d: number) {
  // mIndex is 0-11
  return `${y}-${pad2(mIndex + 1)}-${pad2(d)}`;
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
}) {
  const { tasks, year, monthIndex, onOpenTask } = props;

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
    <div className="grid gap-4 md:grid-cols-12">
      <div className="md:col-span-9">
        <div className="grid grid-cols-7 gap-2 text-xs text-white/50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-1">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {dayCells.map((cell, idx) => {
            if (!cell) {
              return <div key={idx} className="h-32 rounded-2xl border border-white/5 bg-white/[0.01]" />;
            }
            const items = tasksByDue.get(cell.iso) ?? [];
            const isToday = cell.iso === todayIso;
            const show = items.slice(0, 3);
            const more = items.length - show.length;

            return (
              <div
                key={cell.iso}
                className={[
                  "h-32 rounded-2xl border bg-white/[0.02] p-2 overflow-hidden",
                  isToday ? "border-sky-400/30 bg-sky-500/[0.06]" : "border-white/10"
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className={["text-xs font-semibold", isToday ? "text-sky-200" : "text-white/70"].join(" ")}>{cell.day}</div>
                  {items.length > 0 ? <div className="text-[11px] text-white/45">{items.length}</div> : null}
                </div>

                <div className="mt-2 space-y-1">
                  {show.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.title}
                      onClick={() => onOpenTask(t)}
                      className={[
                        "w-full text-left truncate rounded-xl border px-2 py-1 text-[12px] transition",
                        priorityClass(t.priority)
                      ].join(" ")}
                    >
                      {t.title}
                    </button>
                  ))}
                  {more > 0 ? <div className="text-[11px] text-white/45">+{more} more</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:col-span-3">
        <div className="text-xs uppercase tracking-widest text-white/45">No due date</div>
        <div className="mt-2 space-y-2">
          {noDue.length === 0 ? <div className="text-sm text-white/45">Nothing open.</div> : null}
          {noDue.slice(0, 12).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTask(t)}
              className="w-full text-left glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/85 hover:bg-white/[0.04]"
            >
              <div className="truncate font-semibold text-white/90">{t.title}</div>
              <div className="mt-0.5 text-xs text-white/50">Priority {t.priority.toUpperCase()}</div>
            </button>
          ))}
          {noDue.length > 12 ? <div className="text-xs text-white/45">+{noDue.length - 12} more</div> : null}
        </div>
      </div>
    </div>
  );
}

