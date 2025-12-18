"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { FunnelComparisonLineChart } from "@/components/charts/FunnelComparisonLineChart";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { ConversionFlow } from "@/components/charts/ConversionFlow";
import { PageHeader } from "@/components/ds/PageHeader";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { KpiCard } from "@/components/ds/KpiCard";
import { PageShell, Surface } from "@/components/ds/Surface";
import { MONTHS, clampPercent, monthLabel } from "@/lib/digitalSnapshot";
import { formatNumber, formatPKR, formatPKRCompact } from "@/lib/format";
import {
  PlanChannel,
  PlanChannelInputs,
  PlanVersion,
  Project,
  ProjectActuals,
  ProjectTargets,
  getPlanChannelInputs,
  getProjectActuals,
  getProjectTargets,
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

function computeTargetsFrom(
  targets: ProjectTargets | null,
  inputs: PlanChannelInputs | null
): {
  dealsRequired: number;
  channelDealsRequired: number;
  targetLeads: number;
  targetQualifiedLeads: number;
  qualifiedMeetingsRequired: number;
} {
  const salesTargetSqft = targets?.sales_target_sqft ?? 0;
  const avgSqft = targets?.avg_sqft_per_deal ?? 0;
  const dealsRequired = Math.max(0, Math.ceil(salesTargetSqft / Math.max(avgSqft, 1)));

  const pct = inputs?.target_contribution_percent ?? 0;
  const channelDealsRequired = Math.max(0, Math.ceil(dealsRequired * (pct / 100)));
  const qualifiedMeetingsRequired = Math.max(0, channelDealsRequired * 2);

  const targetLeads = Math.max(0, Math.round(inputs?.expected_leads ?? 0));
  const qPct = inputs?.qualification_percent ?? 0;
  const targetQualifiedLeads = Math.max(0, Math.round(targetLeads * (qPct / 100)));

  return { dealsRequired, channelDealsRequired, targetLeads, targetQualifiedLeads, qualifiedMeetingsRequired };
}

export function MonthlySnapshotReport(props: { channel: PlanChannel; fixedProjectId?: string; backHref?: string }) {
  const { channel, fixedProjectId, backHref } = props;

  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(11);
  const [computedExpanded, setComputedExpanded] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>(fixedProjectId ?? "");

  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [activePlanVersion, setActivePlanVersion] = useState<PlanVersion | null>(null);
  const [channelInputs, setChannelInputs] = useState<PlanChannelInputs | null>(null);
  const [actuals, setActuals] = useState<ProjectActuals | null>(null);
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

        if (cancelled) return;

        setTargets(t);
        setActivePlanVersion(active);
        setChannelInputs(row);
        setActuals(a);

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
      leadsGenerated: actuals?.leads ?? 0,
      qualifiedLeads: actuals?.qualified_leads ?? 0,
      meetingsScheduled: actuals?.meetings_scheduled ?? 0,
      meetingsCompleted: actuals?.meetings_done ?? 0,
      dealsWon: actuals?.deals_won ?? 0,
      sqftWon: actuals?.sqft_won ?? 0,
      targets: {
        leadsGenerated: computed.targetLeads,
        qualifiedLeads: computed.targetQualifiedLeads,
        meetingsScheduled: computed.qualifiedMeetingsRequired,
        meetingsCompleted: computed.qualifiedMeetingsRequired
      }
    };
  }, [actuals, channel, computed, channelInputs, selectedMonthIndex, selectedYear]);

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
    { stage: "Meetings Done", target: snapshot.targets.meetingsCompleted, actual: snapshot.meetingsCompleted, variance: snapshot.meetingsCompleted - snapshot.targets.meetingsCompleted }
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
                <select
                  className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/85 hover:bg-white/[0.04]"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={envMissing}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {p.name}
                    </option>
                  ))}
                </select>
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
          {activePlanVersion ? (
            <div className="mt-6">
              <Surface>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white/90">Computed Outputs</div>
                    <div className="mt-1 text-sm text-white/55">From active approved plan version.</div>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    className="glass-inset text-white/80"
                    onPress={() => setComputedExpanded((v) => !v)}
                    aria-expanded={computedExpanded}
                  >
                    <span className="flex items-center gap-2">
                      <span>{computedExpanded ? "Hide details" : "Show details"}</span>
                      <span className={`transition-transform duration-200 ${computedExpanded ? "rotate-180" : ""}`}>▾</span>
                    </span>
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <KpiCard label="Total sales target" value={formatNumber(targets?.sales_target_sqft ?? 0)} />
                  <KpiCard label="Avg deal size" value={formatNumber(targets?.avg_sqft_per_deal ?? 0)} />
                  <KpiCard label={`% required from ${channelTitle(channel).toLowerCase()}`} value={`${channelInputs?.target_contribution_percent ?? 0}%`} />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <KpiCard label="Deals required" value={formatNumber(computed.dealsRequired)} />
                  <KpiCard label={`${channelTitle(channel)} deals required`} value={formatNumber(computed.channelDealsRequired)} />
                  <KpiCard label={`Target leads (${channelTitle(channel).toLowerCase()})`} value={formatNumber(computed.targetLeads)} />
                </div>

                <div
                  className={[
                    "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                    computedExpanded ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
                  ].join(" ")}
                >
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <KpiCard label="Qualified meetings required" value={formatNumber(computed.qualifiedMeetingsRequired)} />
                    <KpiCard label="Target qualified leads" value={formatNumber(computed.targetQualifiedLeads)} />
                    <KpiCard label={`Allocated budget (${channelTitle(channel).toLowerCase()})`} value={formatPKRCompact(snapshot.budgetAllocated)} />
                  </div>
                </div>
              </Surface>
            </div>
          ) : (
            <div className="mt-6">
              <Surface>
                <div className="text-sm text-white/70">No active approved plan version found for this project/month yet.</div>
              </Surface>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Budget Allocated"
              value={formatPKRCompact(snapshot.budgetAllocated)}
              helper="Monthly cap"
            />
            <KpiCard
              label="Budget Spent"
              value={formatPKRCompact(snapshot.budgetSpent)}
              helper={`${budgetUtilizedDisplay} of allocated`}
            />
            <KpiCard
              label="Qualified Leads"
              value={formatNumber(snapshot.qualifiedLeads)}
              helper={`${leadToQualifiedPct.toFixed(0)}% of ${formatNumber(snapshot.leadsGenerated)} leads`}
            />
            <KpiCard
              label="Meetings Completed"
              value={formatNumber(snapshot.meetingsCompleted)}
              helper={`${qualifiedToMeetingPct.toFixed(0)}% of ${formatNumber(snapshot.qualifiedLeads)} qualified`}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <KpiCard label="Deals Won" value={formatNumber(snapshot.dealsWon)} helper="Sales Ops actual" />
            <KpiCard label="Sqft Won" value={formatNumber(snapshot.sqftWon)} helper="Sales Ops actual" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-7">
              <div className="mb-4">
                <div className="text-lg font-semibold text-white/90">Contribution to Funnel</div>
                <div className="mt-1 text-sm text-white/55">Target vs actual</div>
              </div>

              <FunnelComparisonLineChart
                points={contributionRows.map((r) => ({ label: r.stage, target: r.target, actual: r.actual }))}
                formatNumber={formatNumber}
              />
            </Surface>

            <Surface className="md:col-span-5">
              <div className="mb-4">
                <div className="text-lg font-semibold text-white/90">Contribution Details</div>
              </div>

              <TargetActualBars
                items={contributionRows.map((r) => ({ stage: r.stage, target: r.target, actual: r.actual }))}
                formatNumber={formatNumber}
              />
            </Surface>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-7">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-semibold text-white/90">Funnel</div>
                <div className="text-sm text-white/55">This month</div>
              </div>
              <div className="mb-2 text-sm font-semibold text-white/80">Leads → Qualified → Meetings</div>
              <div className="text-sm text-white/55">Conversion rates from actuals.</div>

              <div className="mt-5">
                <ConversionFlow
                  steps={[
                    { from: "Leads", to: "Qualified", percent: leadToQualifiedPct, colorClassName: "bg-emerald-400" },
                    { from: "Qualified", to: "Meeting", percent: qualifiedToMeetingPct, colorClassName: "bg-fuchsia-400" }
                  ]}
                />
              </div>
            </Surface>

            <Surface className="md:col-span-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-semibold text-white/90">Details</div>
              </div>

              <div className="glass-inset rounded-2xl">
                <Table aria-label="Monthly snapshot metrics" removeWrapper className="text-white/80">
                  <TableHeader>
                    <TableColumn className="text-white/50">Metric</TableColumn>
                    <TableColumn className="text-white/50">Value</TableColumn>
                  </TableHeader>
                  <TableBody items={rows}>
                    {(item) => (
                      <TableRow key={item.metric} className="odd:bg-white/0 even:bg-white/[0.02]">
                        <TableCell className="text-white/60">{item.metric}</TableCell>
                        <TableCell className="font-medium text-white/90">{item.value}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Surface>
          </div>
        </PageShell>
      </div>
    </main>
  );
}


