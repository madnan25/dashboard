"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { PageHeader } from "@/components/ds/PageHeader";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { PillSelect } from "@/components/ds/PillSelect";
import { PageShell, Surface } from "@/components/ds/Surface";
import { SnapshotChartsAndDetails } from "@/components/reports/monthlySnapshot/SnapshotChartsAndDetails";
import { SnapshotKpiSummary } from "@/components/reports/monthlySnapshot/SnapshotKpiSummary";
import { MONTHS, clampPercent, monthLabel } from "@/lib/digitalSnapshot";
import { formatNumber, formatPKR } from "@/lib/format";
import { computeTargetsFrom } from "@/lib/reports/snapshotMath";
import {
  PlanChannel,
  PlanChannelInputs,
  PlanVersion,
  Project,
  ProjectActuals,
  ProjectActualsChannel,
  ProjectTargets,
  getPlanChannelInputs,
  getProjectActuals,
  getProjectTargets,
  listProjectActualsChannels,
  listPlanVersions,
  listProjects
} from "@/lib/dashboardDb";

type MetricRow = { metric: string; value: string };

type ContributionRow = {
  stage: string;
  target: number;
  actual: number;
  variance: number;
};

function monthNumber(monthIndex: number) {
  return monthIndex + 1;
}

function channelTitle(channel: PlanChannel) {
  switch (channel) {
    case "digital":
      return "Digital";
    case "inbound":
      return "Inbound";
    case "activations":
      return "Activations";
  }
}

// computeTargetsFrom moved to lib/reports/snapshotMath.ts

export function MonthlySnapshotReport(props: { channel: PlanChannel; fixedProjectId?: string; backHref?: string }) {
  const { channel, fixedProjectId, backHref } = props;

  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => new Date().getMonth());

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>(fixedProjectId ?? "");

  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [activePlanVersion, setActivePlanVersion] = useState<PlanVersion | null>(null);
  const [channelInputs, setChannelInputs] = useState<PlanChannelInputs | null>(null);
  const [actuals, setActuals] = useState<ProjectActuals | null>(null);
  const [channelActuals, setChannelActuals] = useState<ProjectActualsChannel | null>(null);
  const [status, setStatus] = useState<string>("");

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const month = useMemo(() => monthNumber(selectedMonthIndex), [selectedMonthIndex]);

  const [trend, setTrend] = useState(() => {
    const labels: string[] = [];
    const spend: number[] = [];
    const qualified: number[] = [];
    const meetings: number[] = [];
    const monthsBack = 6;
    for (let i = monthsBack - 1; i >= 0; i--) {
      const m = selectedMonthIndex - i;
      const y = selectedYear + Math.floor(m / 12);
      const idx = ((m % 12) + 12) % 12;
      labels.push(MONTHS[idx] ?? "—");
      spend.push(0);
      qualified.push(0);
      meetings.push(0);
    }
    return { labels, spend, qualified, meetings };
  });

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (envMissing) return;
      try {
        const projs = await listProjects();
        if (cancelled) return;
        setProjects(projs);
        if (!fixedProjectId && !projectId && projs.length > 0) setProjectId(projs[0]!.id);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load projects");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envMissing]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!projectId || envMissing) return;
      try {
        setStatus("");

        const [t, versions, a] = await Promise.all([
          getProjectTargets(projectId, selectedYear, month),
          listPlanVersions(projectId, selectedYear, month),
          getProjectActuals(projectId, selectedYear, month)
        ]);

        const active = versions.find((v) => v.active && v.status === "approved") ?? null;
        const inputs = active ? await getPlanChannelInputs(active.id) : [];
        const row = (inputs ?? []).find((r) => r.channel === channel) ?? null;
        const channelRows = await listProjectActualsChannels(projectId, selectedYear, month);
        const aCh = (channelRows ?? []).find((r) => r.channel === channel) ?? null;

        if (cancelled) return;

        setTargets(t);
        setActivePlanVersion(active);
        setChannelInputs(row);
        setActuals(a);
        setChannelActuals(aCh);

        // Trend (last 6 months) from actuals only. Budget spend not tracked yet.
        const monthsBack = 6;
        const labels: string[] = [];
        const qualifiedArr: number[] = [];
        const meetingsArr: number[] = [];

        const monthQueries = Array.from({ length: monthsBack }, (_, idxFromStart) => {
          const i = monthsBack - 1 - idxFromStart;
          const m0 = selectedMonthIndex - i;
          const y0 = selectedYear + Math.floor(m0 / 12);
          const idx0 = ((m0 % 12) + 12) % 12;
          labels.push(MONTHS[idx0] ?? "—");
          return getProjectActuals(projectId, y0, idx0 + 1);
        });

        const results = await Promise.all(monthQueries);
        for (const r of results) {
          qualifiedArr.push(r?.qualified_leads ?? 0);
          meetingsArr.push(r?.meetings_done ?? 0);
        }

        if (cancelled) return;
        setTrend({ labels, spend: new Array(monthsBack).fill(0), qualified: qualifiedArr, meetings: meetingsArr });
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load snapshot data");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [channel, envMissing, month, projectId, selectedMonthIndex, selectedYear]);

  const computed = useMemo(() => computeTargetsFrom(targets, channelInputs), [targets, channelInputs]);

  const snapshot = useMemo(() => {
    const budgetAllocated = channelInputs?.allocated_budget ?? 0;
    const budgetSpent =
      channel === "digital"
        ? actuals?.spend_digital ?? 0
        : channel === "inbound"
          ? actuals?.spend_inbound ?? 0
          : actuals?.spend_activations ?? 0;

    return {
      monthLabel: monthLabel(selectedMonthIndex, selectedYear),
      budgetAllocated,
      budgetSpent,
      leadsGenerated: channelActuals?.leads ?? 0,
      qualifiedLeads: channelActuals?.qualified_leads ?? 0,
      meetingsScheduled: channelActuals?.meetings_scheduled ?? 0,
      meetingsCompleted: channelActuals?.meetings_done ?? 0,
      dealsWon: channelActuals?.deals_won ?? 0,
      sqftWon: channelActuals?.sqft_won ?? 0,
      targets: {
        sqftWon: computed.targetSqft,
        leadsGenerated: computed.targetLeads,
        qualifiedLeads: computed.targetQualifiedLeads,
        meetingsScheduled: computed.meetingsScheduledRequired,
        meetingsCompleted: computed.meetingsDoneRequired,
        dealsWon: computed.channelDealsRequired
      }
    };
  }, [actuals, channel, channelActuals, computed, channelInputs, selectedMonthIndex, selectedYear]);

  const budgetUtilizedPctRaw =
    snapshot.budgetAllocated > 0 ? (snapshot.budgetSpent / snapshot.budgetAllocated) * 100 : NaN;
  const budgetUtilizedDisplay = Number.isFinite(budgetUtilizedPctRaw)
    ? `${clampPercent(budgetUtilizedPctRaw).toFixed(1)}%`
    : snapshot.budgetSpent > 0
      ? "Over budget"
      : "0.0%";

  const rows: MetricRow[] = [
    { metric: `${channelTitle(channel)} Budget Allocated`, value: formatPKR(snapshot.budgetAllocated) },
    { metric: `${channelTitle(channel)} Budget Spent`, value: `${formatPKR(snapshot.budgetSpent)} (${budgetUtilizedDisplay})` },
    { metric: "Leads (actual)", value: formatNumber(snapshot.leadsGenerated) },
    { metric: "Qualified Leads (actual)", value: formatNumber(snapshot.qualifiedLeads) },
    { metric: "Meetings Done (actual)", value: formatNumber(snapshot.meetingsCompleted) },
    { metric: "Deals won (actual)", value: formatNumber(snapshot.dealsWon) },
    { metric: "Sqft won (actual)", value: formatNumber(snapshot.sqftWon) }
  ];

  const contributionRows: ContributionRow[] = [
    { stage: "Leads", target: snapshot.targets.leadsGenerated, actual: snapshot.leadsGenerated, variance: snapshot.leadsGenerated - snapshot.targets.leadsGenerated },
    { stage: "Qualified Leads", target: snapshot.targets.qualifiedLeads, actual: snapshot.qualifiedLeads, variance: snapshot.qualifiedLeads - snapshot.targets.qualifiedLeads },
    { stage: "Meetings Done", target: snapshot.targets.meetingsCompleted, actual: snapshot.meetingsCompleted, variance: snapshot.meetingsCompleted - snapshot.targets.meetingsCompleted },
    { stage: "Deals won", target: snapshot.targets.dealsWon, actual: snapshot.dealsWon, variance: snapshot.dealsWon - snapshot.targets.dealsWon }
  ];

  const leadToQualifiedPct = clampPercent((snapshot.qualifiedLeads / Math.max(snapshot.leadsGenerated, 1)) * 100);
  const qualifiedToMeetingPct = clampPercent((snapshot.meetingsCompleted / Math.max(snapshot.qualifiedLeads, 1)) * 100);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? "—";
  const title = `${channelTitle(channel)} – Monthly Snapshot`;

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title={title}
          subtitle={projectName}
          showBack
          backHref={backHref ?? "/projects"}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <MonthYearPicker
                monthIndex={selectedMonthIndex}
                year={selectedYear}
                label={snapshot.monthLabel}
                onChange={(next) => {
                  setSelectedMonthIndex(next.monthIndex);
                  setSelectedYear(next.year);
                }}
              />
              {!fixedProjectId ? (
                <PillSelect value={projectId} onChange={setProjectId} disabled={envMissing} ariaLabel="Project">
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {p.name}
                    </option>
                  ))}
                </PillSelect>
              ) : null}
            </div>
          }
        />

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        <PageShell>
          <SnapshotKpiSummary
            snapshot={snapshot}
            budgetUtilizedDisplay={budgetUtilizedDisplay}
            leadToQualifiedPct={leadToQualifiedPct}
            qualifiedToMeetingPct={qualifiedToMeetingPct}
          />

          <SnapshotChartsAndDetails
            channel={channel}
            contributionRows={contributionRows}
            leadToQualifiedPct={leadToQualifiedPct}
            qualifiedToMeetingPct={qualifiedToMeetingPct}
            rows={rows}
          />
        </PageShell>
      </div>
    </main>
  );
}


