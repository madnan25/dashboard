"use client";

import Link from "next/link";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
} from "@heroui/react";
import { FunnelComparisonLineChart } from "@/components/charts/FunnelComparisonLineChart";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { ConversionFlow } from "@/components/charts/ConversionFlow";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { KpiCard } from "@/components/ds/KpiCard";
import { PageShell, Surface } from "@/components/ds/Surface";
import { MONTHS, clampPercent, monthLabel } from "@/lib/digitalSnapshot";
import { formatNumber, formatPKR, formatPKRCompact } from "@/lib/format";
import {
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
import { useEffect, useMemo, useState } from "react";

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

function computeTargetsFrom(
  targets: ProjectTargets | null,
  digital: PlanChannelInputs | null
): {
  dealsRequired: number;
  digitalDealsRequired: number;
  targetLeads: number;
  targetQualifiedLeads: number;
  digitalQualifiedMeetingsRequired: number;
} {
  const salesTargetSqft = targets?.sales_target_sqft ?? 0;
  const avgSqft = targets?.avg_sqft_per_deal ?? 0;
  const dealsRequired = Math.max(0, Math.ceil(salesTargetSqft / Math.max(avgSqft, 1)));

  const digitalPct = digital?.target_contribution_percent ?? 0;
  const digitalDealsRequired = Math.max(0, Math.ceil(dealsRequired * (digitalPct / 100)));
  const digitalQualifiedMeetingsRequired = Math.max(0, digitalDealsRequired * 2);

  const targetLeads = Math.max(0, Math.round(digital?.expected_leads ?? 0));
  const qPct = digital?.qualification_percent ?? 0;
  const targetQualifiedLeads = Math.max(0, Math.round(targetLeads * (qPct / 100)));

  return { dealsRequired, digitalDealsRequired, targetLeads, targetQualifiedLeads, digitalQualifiedMeetingsRequired };
}

export default function DigitalMonthlySnapshotPage() {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(11);
  const [computedExpanded, setComputedExpanded] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [activePlanVersion, setActivePlanVersion] = useState<PlanVersion | null>(null);
  const [digitalInputs, setDigitalInputs] = useState<PlanChannelInputs | null>(null);
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
        if (!projectId && projs.length > 0) setProjectId(projs[0]!.id);
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
        const digital = (inputs ?? []).find((r) => r.channel === "digital") ?? null;

        if (cancelled) return;

        setTargets(t);
        setActivePlanVersion(active);
        setDigitalInputs(digital);
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
  }, [envMissing, month, projectId, selectedMonthIndex, selectedYear]);

  const computed = useMemo(() => computeTargetsFrom(targets, digitalInputs), [targets, digitalInputs]);

  const snapshot = useMemo(() => {
    const budgetAllocated = digitalInputs?.allocated_budget ?? 0;
    const budgetSpent = 0; // not tracked yet in schema

    return {
      monthLabel: monthLabel(selectedMonthIndex, selectedYear),
      budgetAllocated,
      budgetSpent,
      leadsGenerated: actuals?.leads ?? 0,
      qualifiedLeads: actuals?.qualified_leads ?? 0,
      meetingsScheduled: actuals?.meetings_scheduled ?? 0,
      meetingsCompleted: actuals?.meetings_done ?? 0,
      targets: {
        leadsGenerated: computed.targetLeads,
        qualifiedLeads: computed.targetQualifiedLeads,
        meetingsScheduled: computed.digitalQualifiedMeetingsRequired,
        meetingsCompleted: computed.digitalQualifiedMeetingsRequired
      }
    };
  }, [actuals, computed, digitalInputs, selectedMonthIndex, selectedYear]);

  const budgetUtilizedPctRaw =
    snapshot.budgetAllocated > 0 ? (snapshot.budgetSpent / snapshot.budgetAllocated) * 100 : NaN;
  const budgetUtilizedDisplay = Number.isFinite(budgetUtilizedPctRaw)
    ? `${clampPercent(budgetUtilizedPctRaw).toFixed(1)}%`
    : snapshot.budgetSpent > 0
      ? "Over budget"
      : "0.0%";

  const rows: MetricRow[] = [
    { metric: "Digital Budget Allocated", value: formatPKR(snapshot.budgetAllocated) },
    { metric: "Digital Budget Spent", value: formatPKR(snapshot.budgetSpent) },
    { metric: "% Budget Utilized", value: budgetUtilizedDisplay },
    { metric: "Leads (actual)", value: formatNumber(snapshot.leadsGenerated) },
    { metric: "Qualified Leads (actual)", value: formatNumber(snapshot.qualifiedLeads) },
    { metric: "Meetings Done (actual)", value: formatNumber(snapshot.meetingsCompleted) }
  ];

  const contributionRows: ContributionRow[] = [
    {
      stage: "Leads",
      target: snapshot.targets.leadsGenerated,
      actual: snapshot.leadsGenerated,
      variance: snapshot.leadsGenerated - snapshot.targets.leadsGenerated
    },
    {
      stage: "Qualified Leads",
      target: snapshot.targets.qualifiedLeads,
      actual: snapshot.qualifiedLeads,
      variance: snapshot.qualifiedLeads - snapshot.targets.qualifiedLeads
    },
    {
      stage: "Meetings Done",
      target: snapshot.targets.meetingsCompleted,
      actual: snapshot.meetingsCompleted,
      variance: snapshot.meetingsCompleted - snapshot.targets.meetingsCompleted
    }
  ];

  const leadToQualifiedPct = clampPercent((snapshot.qualifiedLeads / Math.max(snapshot.leadsGenerated, 1)) * 100);
  const qualifiedToMeetingPct = clampPercent((snapshot.meetingsCompleted / Math.max(snapshot.qualifiedLeads, 1)) * 100);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? "—";

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl">
        <PageShell>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-2xl font-semibold tracking-tight text-white/95">Digital – Monthly Snapshot</div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-white/60">{projectName}</div>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <MonthYearPicker
                  monthIndex={selectedMonthIndex}
                  year={selectedYear}
                  label={snapshot.monthLabel}
                  onChange={(next) => {
                    setSelectedMonthIndex(next.monthIndex);
                    setSelectedYear(next.year);
                  }}
                />
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <select
                  className="glass-inset rounded-lg px-3 py-2 text-sm text-white/85"
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
              </div>
              {status ? <div className="text-sm text-amber-200/90">{status}</div> : null}
            </div>

            <div className="flex items-center gap-3">
              <Button as={Link} href="/" size="sm" variant="flat" className="glass-inset text-white/80">
                Back to home
              </Button>
            </div>
          </div>

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
                  <KpiCard
                    label="% required from digital"
                    value={`${digitalInputs?.target_contribution_percent ?? 0}%`}
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <KpiCard label="Deals required" value={formatNumber(computed.dealsRequired)} />
                  <KpiCard label="Digital deals required" value={formatNumber(computed.digitalDealsRequired)} />
                  <KpiCard label="Target leads (digital)" value={formatNumber(computed.targetLeads)} />
                </div>

                <div
                  className={[
                    "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                    computedExpanded ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
                  ].join(" ")}
                >
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <KpiCard
                      label="Digital qualified meetings required"
                      value={formatNumber(computed.digitalQualifiedMeetingsRequired)}
                    />
                    <KpiCard label="Target qualified leads" value={formatNumber(computed.targetQualifiedLeads)} />
                    <KpiCard label="Allocated budget (digital)" value={formatPKRCompact(snapshot.budgetAllocated)} />
                  </div>
                </div>
              </Surface>
            </div>
          ) : (
            <div className="mt-6">
              <Surface>
                <div className="text-sm text-white/70">
                  No active approved plan version found for this project/month yet.
                </div>
              </Surface>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Digital Budget Allocated"
              value={formatPKRCompact(snapshot.budgetAllocated)}
              helper="From approved plan"
              delta={{ value: "+0.0%", direction: "flat", tone: "neutral" }}
              deltaLabel="vs last month"
            />
            <KpiCard
              label="Qualified Leads"
              value={formatNumber(snapshot.qualifiedLeads)}
              helper={`${leadToQualifiedPct.toFixed(0)}% of ${formatNumber(snapshot.leadsGenerated)} leads`}
              delta={{ value: "+0.0%", direction: "flat", tone: "neutral" }}
              deltaLabel="vs last month"
            />
            <KpiCard
              label="Meetings Completed"
              value={formatNumber(snapshot.meetingsCompleted)}
              helper={`${qualifiedToMeetingPct.toFixed(0)}% of ${formatNumber(snapshot.qualifiedLeads)} qualified`}
              delta={{ value: "+0.0%", direction: "flat", tone: "neutral" }}
              deltaLabel="vs last month"
            />
            <KpiCard
              label="Trend (qualified)"
              value={formatNumber(trend.qualified.at(-1) ?? 0)}
              helper="Last 6 months"
              delta={{ value: "+0.0%", direction: "flat", tone: "neutral" }}
              deltaLabel=""
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-7">
              <div className="mb-4">
                <div className="text-lg font-semibold text-white/90">Digital Contribution to Funnel</div>
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
                    {
                      from: "Qualified",
                      to: "Meeting",
                      percent: qualifiedToMeetingPct,
                      colorClassName: "bg-fuchsia-400"
                    }
                  ]}
                />
              </div>
            </Surface>

            <Surface className="md:col-span-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-semibold text-white/90">Details</div>
              </div>

              <div className="glass-inset rounded-2xl">
                <Table aria-label="Digital monthly snapshot metrics" removeWrapper className="text-white/80">
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
