"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { MasterCalendar } from "@/components/tasks/MasterCalendar";
import { PillSelect } from "@/components/ds/PillSelect";
import { TasksCalendar } from "@/components/tasks/TasksCalendar";
import type { MasterCalendarTask, Profile, Task } from "@/lib/dashboardDb";
import { getCurrentProfile, listMasterCalendarTasks, listTasks, updateTask } from "@/lib/dashboardDb";
import { MONTHS } from "@/lib/digitalSnapshot";
import { isMarketingManagerProfile, isMarketingTeamProfile, taskIsOpen } from "@/components/tasks/taskModel";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, monthIndex: number) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const from = `${year}-${pad2(monthIndex + 1)}-01`;
  const to = `${year}-${pad2(monthIndex + 1)}-${pad2(daysInMonth)}`;
  return { from, to };
}

type CalendarMode = "master" | "marketing";

export function MasterCalendarPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<CalendarMode>("master");
  const [masterTasks, setMasterTasks] = useState<MasterCalendarTask[]>([]);
  const [marketingTasks, setMarketingTasks] = useState<Task[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthIndex, setMonthIndex] = useState(() => new Date().getMonth());

  const label = useMemo(() => `${MONTHS[monthIndex]} ${year}`, [monthIndex, year]);
  const isCmo = profile?.role === "cmo";
  const isManager = isMarketingManagerProfile(profile) || Boolean(isCmo);
  const canOpenTasks = useMemo(() => Boolean(profile && (isCmo || isMarketingTeamProfile(profile))), [isCmo, profile]);
  const canSeeMarketingCalendar = canOpenTasks;

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const me = await getCurrentProfile();
        if (cancelled) return;
        setProfile(me);
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
    let cancelled = false;
    async function load() {
      try {
        setStatus("");
        const { from, to } = monthRange(year, monthIndex);
        const rows = await listMasterCalendarTasks({ dueFrom: from, dueTo: to });
        if (cancelled) return;
        setMasterTasks(rows);
      } catch (e) {
        if (cancelled) return;
        setMasterTasks([]);
        setStatus(e instanceof Error ? e.message : "Failed to load master calendar");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [monthIndex, year]);

  useEffect(() => {
    let cancelled = false;
    async function loadMarketing() {
      if (!canSeeMarketingCalendar) return;
      if (mode !== "marketing") return;
      try {
        setStatus("");
        const rows = await listTasks();
        if (cancelled) return;
        setMarketingTasks(rows);
      } catch (e) {
        if (cancelled) return;
        setMarketingTasks([]);
        setStatus(e instanceof Error ? e.message : "Failed to load tasks");
      }
    }
    loadMarketing();
    return () => {
      cancelled = true;
    };
  }, [canSeeMarketingCalendar, mode]);

  const marketingCalendarTasks = useMemo(() => {
    const monthKey = `${year}-${pad2(monthIndex + 1)}`;
    return marketingTasks
      .filter((t) => taskIsOpen(t))
      .filter((t) => !t.due_at || t.due_at.startsWith(monthKey));
  }, [marketingTasks, monthIndex, year]);

  function canEditDueForTask(t: Task) {
    if (isCmo) return true;
    if (isManager) return true; // marketing managers can move tickets
    const me = profile?.id ?? null;
    if (!me) return false;
    return t.created_by === me;
  }

  async function onMoveTaskDue(taskId: string, dueAt: string | null) {
    const prev = marketingTasks;
    const existing = marketingTasks.find((t) => t.id === taskId) ?? null;
    if (!existing) return;
    if (!canEditDueForTask(existing)) {
      setStatus("Only the creator or a marketing manager can change due dates.");
      return;
    }
    const nextDue = dueAt || null;
    if ((existing.due_at ?? null) === nextDue) return;

    setMarketingTasks((cur) =>
      cur.map((t) => (t.id === taskId ? { ...t, due_at: nextDue, updated_at: new Date().toISOString() } : t))
    );
    try {
      await updateTask(taskId, { due_at: nextDue });
      setStatus("");
    } catch (e) {
      setMarketingTasks(prev);
      setStatus(e instanceof Error ? e.message : "Failed to move ticket");
    }
  }

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Master Calendar"
          subtitle="Major deadlines across Marketing + Sales + Design & production. View-only."
          showBack
          backHref="/"
          right={
            <div className="hidden md:flex items-center gap-2">
              {canSeeMarketingCalendar ? (
                <PillSelect value={mode} onChange={(v) => setMode(v as CalendarMode)} ariaLabel="Calendar mode">
                  <option value="master" className="bg-zinc-900">
                    Master
                  </option>
                  <option value="marketing" className="bg-zinc-900">
                    Marketing calendar
                  </option>
                </PillSelect>
              ) : null}
              <MonthYearPicker
                monthIndex={monthIndex}
                year={year}
                label={label}
                showJumpToCurrent
                onChange={(next) => {
                  setMonthIndex(next.monthIndex);
                  setYear(next.year);
                }}
              />
            </div>
          }
        />

        <div className="md:hidden">
          <Surface>
            <div className="flex flex-wrap items-center gap-2">
              {canSeeMarketingCalendar ? (
                <PillSelect value={mode} onChange={(v) => setMode(v as CalendarMode)} ariaLabel="Calendar mode">
                  <option value="master" className="bg-zinc-900">
                    Master
                  </option>
                  <option value="marketing" className="bg-zinc-900">
                    Marketing calendar
                  </option>
                </PillSelect>
              ) : null}
              <MonthYearPicker
                monthIndex={monthIndex}
                year={year}
                label={label}
                showJumpToCurrent
                onChange={(next) => {
                  setMonthIndex(next.monthIndex);
                  setYear(next.year);
                }}
              />
            </div>
          </Surface>
        </div>

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        <Surface>
          {mode === "marketing" ? (
            canSeeMarketingCalendar ? (
              <TasksCalendar
                tasks={marketingCalendarTasks}
                year={year}
                monthIndex={monthIndex}
                onOpenTask={(t) => router.push(`/tasks/${t.id}`)}
                canEditDueForTask={canEditDueForTask}
                onMoveTaskDue={onMoveTaskDue}
              />
            ) : (
              <div className="text-sm text-white/55">Marketing calendar is only available to the marketing team.</div>
            )
          ) : (
            <>
              <MasterCalendar
                tasks={masterTasks}
                year={year}
                monthIndex={monthIndex}
                onOpenTask={
                  canOpenTasks
                    ? (taskId) => {
                        router.push(`/tasks/${taskId}`);
                      }
                    : undefined
                }
              />
              {!canOpenTasks ? (
                <div className="mt-4 text-xs text-white/45">
                  You can view master deadlines here, but only marketing team members can open the underlying tickets.
                </div>
              ) : null}
            </>
          )}
        </Surface>
      </div>
    </main>
  );
}

