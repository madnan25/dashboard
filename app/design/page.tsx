"use client";

import { PageShell, Surface } from "@/components/ds/Surface";
import { KpiCard } from "@/components/ds/KpiCard";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { BackButton } from "@/components/nav/BackButton";
import { FunnelComparisonLineChart } from "@/components/charts/FunnelComparisonLineChart";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { ConversionFlow } from "@/components/charts/ConversionFlow";
import { formatNumber, formatPKRCompact } from "@/lib/format";
import { useMemo, useState } from "react";
import { buildSnapshot } from "@/lib/digitalSnapshot";

export default function DesignSystemPage() {
  const [year, setYear] = useState(2025);
  const [monthIndex, setMonthIndex] = useState(11);

  const snapshot = useMemo(() => buildSnapshot(monthIndex, year), [monthIndex, year]);

  const contributionRows = [
    { stage: "Leads", target: 1500, actual: snapshot.leadsGenerated },
    { stage: "Qualified Leads", target: snapshot.targets.qualifiedLeads, actual: snapshot.qualifiedLeads },
    { stage: "Meetings Scheduled", target: 90, actual: snapshot.meetingsScheduled },
    { stage: "Meetings Done", target: snapshot.targets.meetingsCompleted, actual: snapshot.meetingsCompleted }
  ];

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-white/95">Design System</div>
            <div className="text-sm text-white/55">Reusable UI pieces used by the dashboard.</div>
          </div>
        </div>

        <PageShell>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Navigation</div>
              <div className="text-sm text-white/55">Global back button pill used in the top nav.</div>
            </div>
            <BackButton className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] text-white/85 hover:bg-white/[0.04] hover:border-white/15" />
          </div>
        </PageShell>

        <PageShell>
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold text-white/90">MonthYearPicker</div>
            <MonthYearPicker
              monthIndex={monthIndex}
              year={year}
              label={snapshot.monthLabel}
              onChange={(next) => {
                setMonthIndex(next.monthIndex);
                setYear(next.year);
              }}
            />
          </div>
        </PageShell>

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Budget Allocated" value={formatPKRCompact(snapshot.budgetAllocated)} helper="Monthly cap" />
          <KpiCard
            label="Budget Spent"
            value={formatPKRCompact(snapshot.budgetSpent)}
            helper={`Allocated: ${formatPKRCompact(snapshot.budgetAllocated)}`}
            delta={{ value: "76.3%", direction: "flat", tone: "good" }}
            deltaLabel="of allocated"
            deltaShowArrow={false}
          />
          <KpiCard label="Qualified Leads" value={formatNumber(snapshot.qualifiedLeads)} helper="Dummy KPI" />
          <KpiCard label="Meetings Completed" value={formatNumber(snapshot.meetingsCompleted)} helper="Dummy KPI" />
        </div>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-7">
            <div className="mb-4">
              <div className="text-lg font-semibold text-white/90">FunnelComparisonLineChart</div>
              <div className="text-sm text-white/55">Target vs actual across stages.</div>
            </div>
            <FunnelComparisonLineChart
              points={contributionRows.map((r) => ({ label: r.stage, target: r.target, actual: r.actual }))}
              formatNumber={formatNumber}
            />
          </Surface>

          <Surface className="md:col-span-5">
            <div className="mb-4">
              <div className="text-lg font-semibold text-white/90">TargetActualBars</div>
              <div className="text-sm text-white/55">Stage rows + variance + capped bars.</div>
            </div>
            <TargetActualBars items={contributionRows} formatNumber={formatNumber} />
          </Surface>
        </div>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-7">
            <div className="mb-4">
              <div className="text-lg font-semibold text-white/90">ConversionFlow</div>
              <div className="text-sm text-white/55">Percent-only conversion visualization.</div>
            </div>
            <ConversionFlow
              steps={[
                {
                  from: "Leads",
                  to: "Qualified",
                  percent: (snapshot.qualifiedLeads / Math.max(1, snapshot.leadsGenerated)) * 100,
                  colorClassName: "bg-emerald-400"
                },
                {
                  from: "Qualified",
                  to: "Meeting",
                  percent: (snapshot.meetingsCompleted / Math.max(1, snapshot.qualifiedLeads)) * 100,
                  colorClassName: "bg-fuchsia-400"
                }
              ]}
            />
          </Surface>
        </div>
      </div>
    </main>
  );
}


