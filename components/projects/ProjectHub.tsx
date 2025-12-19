"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { Surface } from "@/components/ds/Surface";
import { ProjectActualsPanel } from "@/components/projects/sections/ProjectActualsPanel";
import { ProjectPlanAllocations } from "@/components/projects/sections/ProjectPlanAllocations";
import { ProjectReportNav } from "@/components/projects/sections/ProjectReportNav";
import { ProjectTargetsKpis } from "@/components/projects/sections/ProjectTargetsKpis";
import { MONTHS } from "@/lib/digitalSnapshot";
import { computeOverallFunnelTargets } from "@/lib/reports/projectHubTargets";
import {
  PlanChannel,
  PlanChannelInputs,
  PlanVersion,
  ProjectActuals,
  ProjectTargets,
  getCurrentProfile,
  getPlanChannelInputs,
  getProjectActuals,
  getProjectTargets,
  listPlanVersions,
  listProjects
} from "@/lib/dashboardDb";

function monthNumber(monthIndex: number) {
  return monthIndex + 1;
}

const CHANNELS: PlanChannel[] = ["digital", "inbound", "activations"];

export type ProjectHubInitial = {
  year: number;
  monthIndex: number;
  projectName: string;
  role: string | null;
  targets: ProjectTargets | null;
  activePlanVersion: PlanVersion | null;
  inputsByChannel: Record<PlanChannel, PlanChannelInputs | null>;
  actuals: ProjectActuals | null;
};

export function ProjectHub(props: { projectId: string; initial?: ProjectHubInitial }) {
  const projectId = props.projectId;
  const initial = props.initial;

  const [selectedYear, setSelectedYear] = useState(initial?.year ?? new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(initial?.monthIndex ?? new Date().getMonth());
  const month = useMemo(() => monthNumber(selectedMonthIndex), [selectedMonthIndex]);
  const monthLabel = useMemo(() => `${MONTHS[selectedMonthIndex]} ${selectedYear}`, [selectedMonthIndex, selectedYear]);

  const [projectName, setProjectName] = useState(initial?.projectName ?? "—");
  const [targets, setTargets] = useState<ProjectTargets | null>(initial?.targets ?? null);
  const [activePlanVersion, setActivePlanVersion] = useState<PlanVersion | null>(initial?.activePlanVersion ?? null);
  const [inputsByChannel, setInputsByChannel] = useState<Record<PlanChannel, PlanChannelInputs | null>>(
    initial?.inputsByChannel ?? { digital: null, inbound: null, activations: null }
  );
  const [actuals, setActuals] = useState<ProjectActuals | null>(initial?.actuals ?? null);
  const [role, setRole] = useState<string | null>(initial?.role ?? null);
  const [status, setStatus] = useState<string>("");

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    async function boot() {
      if (envMissing) return;
      try {
        const [p, projs] = await Promise.all([getCurrentProfile(), listProjects()]);
        if (cancelled) return;
        setRole(p?.role ?? null);
        setProjectName(projs.find((x) => x.id === projectId)?.name ?? "—");
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load project");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [envMissing, projectId, initial]);

  useEffect(() => {
    // If we already rendered this month/year from the server, skip the first client refetch.
    if (initial && selectedYear === initial.year && selectedMonthIndex === initial.monthIndex) return;
    let cancelled = false;
    async function load() {
      if (envMissing) return;
      try {
        setStatus("");
        const [t, versions, a] = await Promise.all([
          getProjectTargets(projectId, selectedYear, month),
          listPlanVersions(projectId, selectedYear, month),
          getProjectActuals(projectId, selectedYear, month)
        ]);

        const active = versions.find((v) => v.active && v.status === "approved") ?? null;
        const inputs = active ? await getPlanChannelInputs(active.id) : [];

        if (cancelled) return;

        setTargets(t);
        setActivePlanVersion(active);
        setActuals(a);

        const map: Record<PlanChannel, PlanChannelInputs | null> = { digital: null, inbound: null, activations: null };
        for (const row of inputs ?? []) map[row.channel] = row;
        setInputsByChannel(map);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load project data");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [envMissing, month, projectId, selectedMonthIndex, selectedYear, initial]);

  const totalBudgetCap = targets?.total_budget ?? 0;
  const budgetSpentTotal = (actuals?.spend_digital ?? 0) + (actuals?.spend_inbound ?? 0) + (actuals?.spend_activations ?? 0);
  const budgetRemaining = Math.max(0, totalBudgetCap - budgetSpentTotal);
  const funnelTargets = useMemo(() => computeOverallFunnelTargets(targets, inputsByChannel), [inputsByChannel, targets]);

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title={projectName}
          subtitle="Master dashboard for this project."
          showBack
          backHref="/projects"
          right={
            <MonthYearPicker
              monthIndex={selectedMonthIndex}
              year={selectedYear}
              label={monthLabel}
              onChange={(next) => {
                setSelectedMonthIndex(next.monthIndex);
                setSelectedYear(next.year);
              }}
            />
          }
        />

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        <ProjectTargetsKpis targets={targets} budgetSpentTotal={budgetSpentTotal} budgetRemaining={budgetRemaining} />

        <ProjectReportNav projectId={projectId} />

        <div className="grid gap-4 md:grid-cols-12">
          <ProjectPlanAllocations activePlanVersion={activePlanVersion} inputsByChannel={inputsByChannel} targets={targets} />
          <ProjectActualsPanel actuals={actuals} role={role} targets={funnelTargets} sqftTarget={targets?.sales_target_sqft ?? 0} />
        </div>
      </div>
    </main>
  );
}

