"use client";

import { useMemo } from "react";
import type { MasterCalendarTask } from "@/lib/dashboardDb";

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

function tagClass(tag: MasterCalendarTask["master_calendar_tag"]) {
  switch (tag) {
    case "sales":
      return "bg-amber-500/15 text-amber-200 border-amber-500/20 hover:bg-amber-500/20";
    case "design":
      return "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/20 hover:bg-fuchsia-500/20";
    case "marketing":
    default:
      return "bg-sky-500/15 text-sky-200 border-sky-500/20 hover:bg-sky-500/20";
  }
}

export function MasterCalendar(props: {
  tasks: MasterCalendarTask[];
  year: number;
  monthIndex: number; // 0-11
  onOpenTask?: (taskId: string) => void;
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
    const map = new Map<string, MasterCalendarTask[]>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const key = t.due_at;
      const cur = map.get(key) ?? [];
      cur.push(t);
      map.set(key, cur);
    }
    // Stable sort: tag first, then priority, then title.
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const tagRank = (x: MasterCalendarTask["master_calendar_tag"]) => (x === "sales" ? 0 : x === "marketing" ? 1 : 2);
        const dt = tagRank(a.master_calendar_tag) - tagRank(b.master_calendar_tag);
        if (dt !== 0) return dt;
        const p = (x: MasterCalendarTask["priority"]) => (x === "p0" ? 0 : x === "p1" ? 1 : x === "p2" ? 2 : 3);
        const dp = p(a.priority) - p(b.priority);
        if (dp !== 0) return dp;
        return (a.title || "").localeCompare(b.title || "");
      });
      map.set(k, arr);
    }
    return map;
  }, [tasks]);

  const dayCells = useMemo(() => {
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: isoDate(year, monthIndex, d), day: d });
    while (cells.length % 7 !== 0) cells.push(null);
    if (cells.length < 35) while (cells.length < 35) cells.push(null);
    return cells;
  }, [daysInMonth, leadingBlanks, monthIndex, year]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400/70" />
          Marketing
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400/70" />
          Sales
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
          <span className="inline-block h-2 w-2 rounded-full bg-fuchsia-400/70" />
          Design &amp; Production
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-3 text-xs text-white/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-3">
        {dayCells.map((cell, idx) => {
          if (!cell) return <div key={idx} className="h-40 rounded-2xl border border-white/5 bg-white/[0.01]" />;
          const items = tasksByDue.get(cell.iso) ?? [];
          const isToday = cell.iso === todayIso;
          const hasOutOfSync = items.some((t) => Boolean(t.out_of_sync));
          const show = items.slice(0, 4);
          const more = items.length - show.length;
          return (
            <div
              key={cell.iso}
              className={[
                "h-40 rounded-2xl border bg-white/[0.02] p-3 overflow-hidden",
                isToday ? "border-sky-400/30 bg-sky-500/[0.06]" : "border-white/10"
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className={["text-xs font-semibold", isToday ? "text-sky-200" : "text-white/70"].join(" ")}>{cell.day}</div>
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
                {show.map((t) => {
                  const clickable = typeof onOpenTask === "function";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      title={(t.out_of_sync ? "Due date course-correct needed (after parent ticket due date). " : "") + (t.title || "")}
                      onClick={() => {
                        if (!clickable) return;
                        onOpenTask(t.id);
                      }}
                      className={[
                        "w-full text-left truncate rounded-xl border px-2 py-1 text-[12px] transition",
                        clickable ? "cursor-pointer" : "cursor-default opacity-90",
                        t.out_of_sync ? "ring-1 ring-rose-400/40 border-rose-500/20" : "",
                        tagClass(t.master_calendar_tag)
                      ].join(" ")}
                      disabled={!clickable}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {t.out_of_sync ? (
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
                  );
                })}
                {more > 0 ? <div className="text-[11px] text-white/45">+{more} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

