"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Button
} from "@heroui/react";
import { FunnelComparisonLineChart } from "@/components/charts/FunnelComparisonLineChart";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { ConversionFlow } from "@/components/charts/ConversionFlow";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { KpiCard } from "@/components/ds/KpiCard";
import { PageShell, Surface } from "@/components/ds/Surface";
import { MONTHS, clampPercent, monthLabel } from "@/lib/digitalSnapshot";
import { formatNumber, formatPKR, formatPKRCompact } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { computeBrandTargets, loadBrandMonthlyActuals, loadBrandMonthlyPlan } from "@/lib/brandStorage";

type MetricRow = { metric: string; value: string };
type ContributionRow = {
  stage: string;
  target: number;
  actual: number;
  variance: number;
};

export default function DigitalMonthlySnapshotPage() {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(11); // Dec
  const [computedExpanded, setComputedExpanded] = useState(false);

  const [savedPlanThisMonth, setSavedPlanThisMonth] = useState<ReturnType<typeof loadBrandMonthlyPlan>>(null);
  const [savedActualsThisMonth, setSavedActualsThisMonth] = useState<ReturnType<typeof loadBrandMonthlyActuals>>(null);
  const [trend, setTrend] = useState(() => {
    // SSR-safe initial trend: correct labels, zero values.
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
    setSavedPlanThisMonth(loadBrandMonthlyPlan(selectedMonthIndex, selectedYear));

    setSavedActualsThisMonth(loadBrandMonthlyActuals(selectedMonthIndex, selectedYear));

    // Build a real trend window from saved actuals only (no dummy).
    const monthsBack = 6;
    const labels: string[] = [];
    const spend: number[] = [];
    const qualified: number[] = [];
    const meetings: number[] = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const m = selectedMonthIndex - i;
      const y = selectedYear + Math.floor(m / 12);
      const idx = ((m % 12) + 12) % 12;

      labels.push(MONTHS[idx] ?? "—");
      const a = loadBrandMonthlyActuals(idx, y);
      spend.push(a?.budgetSpentDigital ?? 0);
      qualified.push(a?.qualifiedLeads ?? 0);
      meetings.push(a?.qualifiedMeetingsCompleted ?? 0);
    }

    setTrend({ labels, spend, qualified, meetings });
  }, [selectedMonthIndex, selectedYear]);

  const computedTargets = useMemo(() => {
    if (!savedPlanThisMonth) return null;
    return computeBrandTargets(savedPlanThisMonth);
  }, [savedPlanThisMonth]);
  const plan = savedPlanThisMonth;

  const snapshot = useMemo(() => {
    const actuals = savedActualsThisMonth;
    const budgetAllocated = savedPlanThisMonth?.allocatedBudgetDigital ?? 0;

    return {
      monthLabel: monthLabel(selectedMonthIndex, selectedYear),
      budgetAllocated,
      budgetSpent: actuals?.budgetSpentDigital ?? 0,
      leadsGenerated: actuals?.leadsGenerated ?? 0,
      qualifiedLeads: actuals?.qualifiedLeads ?? 0,
      meetingsScheduled: actuals?.meetingsScheduled ?? 0,
      meetingsCompleted: actuals?.qualifiedMeetingsCompleted ?? 0,
      targets: {
        leadsGenerated: computedTargets?.targetLeads ?? 0,
        qualifiedLeads: computedTargets?.targetQualifiedLeads ?? 0,
        meetingsScheduled: computedTargets?.digitalQualifiedMeetingsRequired ?? 0,
        meetingsCompleted: computedTargets?.digitalQualifiedMeetingsRequired ?? 0
      }
    };
  }, [computedTargets, savedActualsThisMonth, savedPlanThisMonth, selectedMonthIndex, selectedYear]);

  const budgetUtilizedPctRaw =
    snapshot.budgetAllocated > 0 ? (snapshot.budgetSpent / snapshot.budgetAllocated) * 100 : NaN;
  const budgetUtilizedDisplay = Number.isFinite(budgetUtilizedPctRaw)
    ? `${clampPercent(budgetUtilizedPctRaw).toFixed(1)}%`
    : snapshot.budgetSpent > 0
      ? "Over budget"
      : "0.0%";
  const costPerQualifiedLead =
    snapshot.qualifiedLeads > 0 ? snapshot.budgetSpent / snapshot.qualifiedLeads : 0;
  const costPerMeeting =
    snapshot.meetingsCompleted > 0 ? snapshot.budgetSpent / snapshot.meetingsCompleted : 0;

  const rows: MetricRow[] = [
    { metric: "Budget Allocated", value: formatPKR(snapshot.budgetAllocated) },
    { metric: "Budget Spent", value: formatPKR(snapshot.budgetSpent) },
    { metric: "% Budget Utilized", value: budgetUtilizedDisplay },
    { metric: "Leads Generated", value: formatNumber(snapshot.leadsGenerated) },
    { metric: "Qualified Leads", value: formatNumber(snapshot.qualifiedLeads) },
    { metric: "Meetings Scheduled", value: formatNumber(snapshot.meetingsScheduled) },
    { metric: "Meetings Completed", value: formatNumber(snapshot.meetingsCompleted) },
    { metric: "Cost / Qualified Lead", value: formatPKR(costPerQualifiedLead) },
    { metric: "Cost / Meeting", value: formatPKR(costPerMeeting) }
  ];

  const spendPctRaw =
    snapshot.budgetAllocated > 0 ? (snapshot.budgetSpent / snapshot.budgetAllocated) * 100 : NaN;
  const spendOverBudgetValue = (() => {
    // e.g. "Rs 1.7M" -> "1.7" (cleaner in the small pill)
    const compact = formatPKRCompact(snapshot.budgetSpent);
    return compact.replace(/^(-?)Rs\s+/i, "$1").replace(/[KMB]$/i, "");
  })();
  const spendDelta =
    snapshot.budgetAllocated <= 0
      ? snapshot.budgetSpent > 0
        ? {
            value: spendOverBudgetValue,
            tone: "bad" as const,
            label: "over budget",
          }
        : {
            value: "0.0%",
            tone: "neutral" as const,
            label: "of allocated",
          }
      : spendPctRaw <= 100
        ? {
            value: `${spendPctRaw.toFixed(1)}%`,
            tone: "good" as const,
            label: "of allocated",
          }
        : {
            value: `${(spendPctRaw - 100).toFixed(1)}%`,
            tone: "bad" as const,
            label: "over allocated",
          };
  const qualifiedPctOfLeads = clampPercent(
    (snapshot.qualifiedLeads / Math.max(snapshot.leadsGenerated, 1)) * 100
  );
  const completedPctOfScheduled = clampPercent(
    (snapshot.meetingsCompleted / Math.max(snapshot.meetingsScheduled, 1)) * 100
  );

  const leadToQualifiedPct = clampPercent(
    (snapshot.qualifiedLeads / Math.max(snapshot.leadsGenerated, 1)) * 100
  );
  const qualifiedToMeetingPct = clampPercent(
    (snapshot.meetingsCompleted / Math.max(snapshot.qualifiedLeads, 1)) * 100
  );

  // Dummy deltas vs last month (based on trend arrays)
  const qualifiedDeltaPct =
    trend.qualified.length >= 2
      ? (() => {
          const prev = trend.qualified.at(-2)!;
          const curr = trend.qualified.at(-1)!;
          if (prev <= 0) return 0;
          return ((curr - prev) / prev) * 100;
        })()
      : 0;
  const meetingsDeltaPct =
    trend.meetings.length >= 2
      ? (() => {
          const prev = trend.meetings.at(-2)!;
          const curr = trend.meetings.at(-1)!;
          if (prev <= 0) return 0;
          return ((curr - prev) / prev) * 100;
        })()
      : 0;

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
      stage: "Meetings Scheduled",
      target: snapshot.targets.meetingsScheduled,
      actual: snapshot.meetingsScheduled,
      variance: snapshot.meetingsScheduled - snapshot.targets.meetingsScheduled
    },
    {
      stage: "Meetings Done",
      target: snapshot.targets.meetingsCompleted,
      actual: snapshot.meetingsCompleted,
      variance: snapshot.meetingsCompleted - snapshot.targets.meetingsCompleted
    }
  ];

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl">
        <PageShell>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-2xl font-semibold tracking-tight text-white/95">Digital – Monthly Snapshot</div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-white/60">Analytics</div>
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
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button as={Link} href="/" size="sm" variant="flat" className="glass-inset text-white/80">
                Back to home
              </Button>
            </div>
          </div>

          {computedTargets && plan ? (
            <div className="mt-6">
              <Surface>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white/90">Computed Outputs</div>
                    <div className="mt-1 text-sm text-white/55">Derived from this month’s saved plan.</div>
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
                      <span className={`transition-transform duration-200 ${computedExpanded ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </span>
                  </Button>
                </div>

                {/* Always visible (plan inputs) */}
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <KpiCard label="Total sales target" value={formatNumber(plan.salesTargetSqft)} />
                  <KpiCard label="Average expected deal size" value={formatNumber(plan.averageDealSizeSqft)} />
                  <KpiCard label="% required from digital" value={`${plan.digitalTargetPercent}%`} />
                </div>

                {/* Always visible (key rollups) */}
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <KpiCard label="Deals required" value={formatNumber(computedTargets.dealsRequired)} />
                  <KpiCard label="Digital deals required" value={formatNumber(computedTargets.digitalDealsRequired)} />
                  <KpiCard label="Deals won" value={formatNumber(savedActualsThisMonth?.dealsWon ?? 0)} />
                </div>

                {/* Collapsible (derived outputs) */}
                <div
                  className={[
                    "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                    computedExpanded ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
                  ].join(" ")}
                >
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <KpiCard
                      label="Qualified meetings required"
                      value={formatNumber(computedTargets.qualifiedMeetingsRequired)}
                    />
                    <KpiCard
                      label="Digital qualified meetings required"
                      value={formatNumber(computedTargets.digitalQualifiedMeetingsRequired)}
                    />
                    <KpiCard label="Expected leads" value={formatNumber(computedTargets.targetLeads)} />
                    <KpiCard label="Expected qualified rate" value={`${plan.expectedQualifiedPercent}%`} />
                    <KpiCard label="Qualified leads target" value={formatNumber(computedTargets.targetQualifiedLeads)} />
                  </div>
                </div>
              </Surface>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Budget Allocated"
              value={formatPKRCompact(snapshot.budgetAllocated)}
              helper="Monthly cap"
              delta={{ value: "+0.0%", direction: "flat", tone: "neutral" }}
              deltaLabel="vs last month"
            />
            <KpiCard
              label="Budget Spent"
              value={formatPKRCompact(snapshot.budgetSpent)}
              helper={`Allocated: ${formatPKRCompact(snapshot.budgetAllocated)}`}
              delta={{
                value: spendDelta.value,
                direction: "flat",
                tone: spendDelta.tone
              }}
              deltaLabel={spendDelta.label}
              deltaShowArrow={false}
            />
            <KpiCard
              label="Qualified Leads"
              value={formatNumber(snapshot.qualifiedLeads)}
              helper={`${qualifiedPctOfLeads.toFixed(0)}% of ${formatNumber(snapshot.leadsGenerated)} leads`}
              delta={{
                value: `${qualifiedDeltaPct >= 0 ? "+" : ""}${qualifiedDeltaPct.toFixed(1)}%`,
                direction: qualifiedDeltaPct > 0 ? "up" : qualifiedDeltaPct < 0 ? "down" : "flat",
                tone: qualifiedDeltaPct > 0 ? "good" : qualifiedDeltaPct < 0 ? "bad" : "neutral"
              }}
              deltaLabel="vs last month"
            />
            <KpiCard
              label="Meetings Completed"
              value={formatNumber(snapshot.meetingsCompleted)}
              helper={`${completedPctOfScheduled.toFixed(0)}% of ${formatNumber(snapshot.meetingsScheduled)} scheduled`}
              delta={{
                value: `${meetingsDeltaPct >= 0 ? "+" : ""}${meetingsDeltaPct.toFixed(1)}%`,
                direction: meetingsDeltaPct > 0 ? "up" : meetingsDeltaPct < 0 ? "down" : "flat",
                tone: meetingsDeltaPct > 0 ? "good" : meetingsDeltaPct < 0 ? "bad" : "neutral"
              }}
              deltaLabel="vs last month"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-7">
              <div className="mb-4">
                <div className="text-lg font-semibold text-white/90">Digital Contribution to Sales Funnel</div>
                <div className="mt-1 text-sm text-white/55">Target vs actual (dummy)</div>
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
              <div className="text-sm text-white/55">
                Conversion rates (no raw counts).
              </div>

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


