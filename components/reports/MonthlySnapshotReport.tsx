"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
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
  ProjectActualsDigitalSource,
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
  listProjectActualsDigitalSources,
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

export type MonthlySnapshotReportProps = {
  channel: PlanChannel;
  fixedProjectId?: string;
  backHref?: string;
  initialYear?: number;
  initialMonthIndex?: number;
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

export function MonthlySnapshotReport(props: MonthlySnapshotReportProps) {
  const { channel, fixedProjectId, backHref, initialYear, initialMonthIndex } = props;

  const router = useRouter();
  const pathname = usePathname();

  const [selectedYear, setSelectedYear] = useState(() => initialYear ?? new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => initialMonthIndex ?? new Date().getMonth());

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>(fixedProjectId ?? "");

  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [activePlanVersion, setActivePlanVersion] = useState<PlanVersion | null>(null);
  const [channelInputs, setChannelInputs] = useState<PlanChannelInputs | null>(null);
  const [actuals, setActuals] = useState<ProjectActuals | null>(null);
  const [channelActuals, setChannelActuals] = useState<ProjectActualsChannel | null>(null);
  const [digitalSourceActuals, setDigitalSourceActuals] = useState<ProjectActualsDigitalSource[]>([]);
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
        const [channelRows, dsRows] = await Promise.all([
          listProjectActualsChannels(projectId, selectedYear, month),
          channel === "digital" ? listProjectActualsDigitalSources(projectId, selectedYear, month) : Promise.resolve([])
        ]);
        const aCh = (channelRows ?? []).find((r) => r.channel === channel) ?? null;

        if (cancelled) return;

        setTargets(t);
        setActivePlanVersion(active);
        setChannelInputs(row);
        setActuals(a);
        setChannelActuals(aCh);
        setDigitalSourceActuals(dsRows as ProjectActualsDigitalSource[]);

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

    // Business rule: "Qualified leads" includes "Meetings scheduled"
    // (i.e. qualified_total = qualified + meetings_scheduled)
    const qualifiedLeadsActual = (channelActuals?.qualified_leads ?? 0) + (channelActuals?.meetings_scheduled ?? 0);

    return {
      monthLabel: monthLabel(selectedMonthIndex, selectedYear),
      budgetAllocated,
      budgetSpent,
      leadsGenerated: channelActuals?.leads ?? 0,
      qualifiedLeads: qualifiedLeadsActual,
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
  const budgetOverBy = Math.max(0, snapshot.budgetSpent - snapshot.budgetAllocated);
  const budgetUtilizedDisplay = Number.isFinite(budgetUtilizedPctRaw)
    ? `${budgetUtilizedPctRaw.toFixed(1)}%`
    : snapshot.budgetSpent > 0
      ? "—"
      : "0.0%";
  const budgetTone: "good" | "bad" | "neutral" = budgetOverBy > 0 ? "bad" : "good";

  const digitalBreakdown = useMemo(() => {
    if (channel !== "digital") return null;
    const labelOf = (s: ProjectActualsDigitalSource["source"]) => (s === "meta" ? "Meta" : "Website / WhatsApp / Google");
    const ordered = [...(digitalSourceActuals ?? [])].sort((a, b) => (b.qualified_leads ?? 0) - (a.qualified_leads ?? 0));
    const total = ordered.reduce(
      (acc, r) => {
        acc.leads += r.leads ?? 0;
        acc.notContacted += r.not_contacted ?? 0;
        // Keep breakdown consistent with snapshot: qualified includes meetings scheduled
        acc.qualified += (r.qualified_leads ?? 0) + (r.meetings_scheduled ?? 0);
        acc.meetings += r.meetings_done ?? 0;
        acc.deals += r.deals_won ?? 0;
        acc.sqft += r.sqft_won ?? 0;
        return acc;
      },
      { leads: 0, notContacted: 0, qualified: 0, meetings: 0, deals: 0, sqft: 0 }
    );
    return { ordered, total, labelOf };
  }, [channel, digitalSourceActuals]);

  const addressedLeads = useMemo(() => {
    if (channel !== "digital") return null;
    const totalLeads = channelActuals?.leads ?? 0;
    const notContacted = digitalBreakdown?.total.notContacted ?? 0;
    return Math.max(0, totalLeads - notContacted);
  }, [channel, channelActuals?.leads, digitalBreakdown?.total.notContacted]);

  const rows: MetricRow[] = [
    { metric: `${channelTitle(channel)} Budget Allocated`, value: formatPKR(snapshot.budgetAllocated) },
    { metric: `${channelTitle(channel)} Budget Spent`, value: `${formatPKR(snapshot.budgetSpent)} (${budgetUtilizedDisplay})` },
    {
      metric: "Cost per qualified lead",
      value:
        snapshot.qualifiedLeads > 0 && snapshot.budgetSpent > 0
          ? formatPKR(Math.round(snapshot.budgetSpent / snapshot.qualifiedLeads))
          : "—"
    },
    {
      metric: "Cost per deal won",
      value:
        snapshot.dealsWon > 0 && snapshot.budgetSpent > 0 ? formatPKR(Math.round(snapshot.budgetSpent / snapshot.dealsWon)) : "—"
    },
    { metric: "Leads (actual)", value: formatNumber(snapshot.leadsGenerated) },
    { metric: "Qualified Leads (actual)", value: formatNumber(snapshot.qualifiedLeads) },
    { metric: "Meetings Done (actual)", value: formatNumber(snapshot.meetingsCompleted) },
    { metric: "Deals won (actual)", value: formatNumber(snapshot.dealsWon) },
    { metric: "Sqft won (actual)", value: formatNumber(snapshot.sqftWon) }
  ];

  if (channel === "digital") {
    const notContacted = digitalBreakdown?.total.notContacted ?? 0;
    rows.splice(
      5,
      0,
      { metric: "Not contacted (Digital)", value: formatNumber(notContacted) },
      { metric: "Addressed leads (Digital)", value: formatNumber(Math.max(0, snapshot.leadsGenerated - notContacted)) }
    );
  }

  const contributionRows: ContributionRow[] = [
    { stage: "Leads", target: snapshot.targets.leadsGenerated, actual: snapshot.leadsGenerated, variance: snapshot.leadsGenerated - snapshot.targets.leadsGenerated },
    { stage: "Qualified Leads", target: snapshot.targets.qualifiedLeads, actual: snapshot.qualifiedLeads, variance: snapshot.qualifiedLeads - snapshot.targets.qualifiedLeads },
    { stage: "Meetings Done", target: snapshot.targets.meetingsCompleted, actual: snapshot.meetingsCompleted, variance: snapshot.meetingsCompleted - snapshot.targets.meetingsCompleted },
    { stage: "Deals won", target: snapshot.targets.dealsWon, actual: snapshot.dealsWon, variance: snapshot.dealsWon - snapshot.targets.dealsWon }
  ];

  const leadToQualifiedPct = clampPercent((snapshot.qualifiedLeads / Math.max(snapshot.leadsGenerated, 1)) * 100);
  const leadToQualifiedAddressedPct = useMemo(() => {
    if (channel !== "digital") return null;
    const denom = Math.max(addressedLeads ?? 0, 1);
    return clampPercent((snapshot.qualifiedLeads / denom) * 100);
  }, [addressedLeads, channel, snapshot.qualifiedLeads]);
  const leadToQualifiedTargetPct = channelInputs?.qualification_percent ?? null;
  const qualifiedToMeetingPct = clampPercent((snapshot.meetingsCompleted / Math.max(snapshot.qualifiedLeads, 1)) * 100);
  const qualifiedToMeetingTargetPct = targets?.qualified_to_meeting_done_percent ?? null;
  const meetingToClosePct = clampPercent((snapshot.dealsWon / Math.max(snapshot.meetingsCompleted, 1)) * 100);
  const meetingToCloseTargetPct = targets?.meeting_done_to_close_percent ?? null;

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
                showJumpToCurrent
                onChange={(next) => {
                  setSelectedMonthIndex(next.monthIndex);
                  setSelectedYear(next.year);
                  const qs = new URLSearchParams();
                  qs.set("year", String(next.year));
                  qs.set("monthIndex", String(next.monthIndex));
                  router.replace(`${pathname}?${qs.toString()}`);
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
            budgetOverBy={budgetOverBy}
            budgetTone={budgetTone}
            leadToQualifiedPct={leadToQualifiedPct}
            qualifiedToMeetingPct={qualifiedToMeetingPct}
          />

          <SnapshotChartsAndDetails
            channel={channel}
            contributionRows={contributionRows}
            leadToQualifiedPct={leadToQualifiedPct}
            leadToQualifiedAddressedPct={leadToQualifiedAddressedPct}
            addressedLeads={addressedLeads}
            notContacted={digitalBreakdown?.total.notContacted ?? null}
            leadToQualifiedTargetPct={leadToQualifiedTargetPct}
            qualifiedToMeetingPct={qualifiedToMeetingPct}
            qualifiedToMeetingTargetPct={qualifiedToMeetingTargetPct}
            meetingToClosePct={meetingToClosePct}
            meetingToCloseTargetPct={meetingToCloseTargetPct}
            rows={rows}
          />

          {digitalBreakdown ? (
            <div className="mt-6 grid gap-4 md:grid-cols-12">
              <Surface className="md:col-span-12">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white/90">Source breakdown (Digital)</div>
                    <div className="mt-1 text-sm text-white/55">Meta vs Website/WhatsApp/Google (Sales Ops inputs).</div>
                  </div>
                  <div className="text-xs text-white/50">
                    Total qualified: <span className="font-semibold text-white/80">{formatNumber(digitalBreakdown.total.qualified)}</span>
                  </div>
                </div>

                <div className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02]">
                  <div className="grid grid-cols-6 gap-2 px-4 py-3 text-xs text-white/50">
                    <div className="col-span-2">Source</div>
                    <div>Leads</div>
                    <div>Not contacted</div>
                    <div>Qualified</div>
                    <div>Deals</div>
                    <div>Sqft</div>
                  </div>
                  {digitalBreakdown.ordered.map((r) => (
                    <div key={r.source} className="grid grid-cols-6 gap-2 border-t border-white/5 px-4 py-3 text-sm text-white/75">
                      <div className="col-span-2 font-semibold text-white/85">{digitalBreakdown.labelOf(r.source)}</div>
                      <div>{formatNumber(r.leads ?? 0)}</div>
                      <div>{formatNumber(r.not_contacted ?? 0)}</div>
                      <div>{formatNumber((r.qualified_leads ?? 0) + (r.meetings_scheduled ?? 0))}</div>
                      <div>{formatNumber(r.deals_won ?? 0)}</div>
                      <div>{formatNumber(r.sqft_won ?? 0)}</div>
                    </div>
                  ))}
                </div>
              </Surface>
            </div>
          ) : null}
        </PageShell>
      </div>
    </main>
  );
}


