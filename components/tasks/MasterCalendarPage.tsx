"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { MasterCalendar } from "@/components/tasks/MasterCalendar";
import type { MasterCalendarTask, Profile } from "@/lib/dashboardDb";
import { getCurrentProfile, listMasterCalendarTasks } from "@/lib/dashboardDb";
import { MONTHS } from "@/lib/digitalSnapshot";
import { isMarketingTeamProfile } from "@/components/tasks/taskModel";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, monthIndex: number) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const from = `${year}-${pad2(monthIndex + 1)}-01`;
  const to = `${year}-${pad2(monthIndex + 1)}-${pad2(daysInMonth)}`;
  return { from, to };
}

export function MasterCalendarPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MasterCalendarTask[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthIndex, setMonthIndex] = useState(() => new Date().getMonth());

  const label = useMemo(() => `${MONTHS[monthIndex]} ${year}`, [monthIndex, year]);
  const canOpenTasks = useMemo(() => {
    if (!profile) return false;
    if (profile.role === "cmo") return true;
    return isMarketingTeamProfile(profile);
  }, [profile]);

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
        setTasks(rows);
      } catch (e) {
        if (cancelled) return;
        setTasks([]);
        setStatus(e instanceof Error ? e.message : "Failed to load master calendar");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [monthIndex, year]);

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Master Calendar"
          subtitle="Major deadlines across Marketing + Sales. View-only."
          showBack
          backHref="/"
          right={
            <div className="hidden md:flex items-center gap-2">
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
          </Surface>
        </div>

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        <Surface>
          <MasterCalendar
            tasks={tasks}
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
        </Surface>
      </div>
    </main>
  );
}

