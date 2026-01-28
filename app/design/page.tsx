"use client";

import { PageHeader } from "@/components/ds/PageHeader";
import { NavCard } from "@/components/ds/NavCard";
import { PageShell, Surface } from "@/components/ds/Surface";
import { KpiCard } from "@/components/ds/KpiCard";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import { DayDatePicker } from "@/components/ds/DayDatePicker";
import { DropdownItem, DropdownMenu } from "@/components/ds/DropdownMenu";
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
  const [exampleDue, setExampleDue] = useState("2025-12-28");

  const snapshot = useMemo(() => buildSnapshot(monthIndex, year), [monthIndex, year]);

  const contributionRows = [
    { stage: "Leads", target: 1500, actual: snapshot.leadsGenerated },
    { stage: "Qualified Leads", target: snapshot.targets.qualifiedLeads, actual: snapshot.qualifiedLeads },
    { stage: "Meetings Scheduled", target: 90, actual: snapshot.meetingsScheduled },
    { stage: "Meetings Done", target: snapshot.targets.meetingsCompleted, actual: snapshot.meetingsCompleted }
  ];

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader title="Design System" subtitle="Reusable UI pieces used by the dashboard." showBack backHref="/" />

        <PageShell>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Back button</div>
              <div className="text-sm text-white/55">Used by the reusable PageHeader on each page.</div>
            </div>
            <BackButton
              label="← Back"
              className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] text-white/85 hover:bg-white/[0.04] hover:border-white/15"
            />
          </div>
        </PageShell>

        <PageShell>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Buttons</div>
              <div className="text-sm text-white/55">Primary/secondary/danger buttons used across the app.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AppButton intent="secondary" size="sm">
                Secondary
              </AppButton>
              <AppButton intent="primary" size="sm">
                Primary
              </AppButton>
              <AppButton intent="primary" effect="wow" size="sm">
                Primary (wow)
              </AppButton>
              <AppButton intent="danger" size="sm">
                Danger
              </AppButton>
            </div>
          </div>
        </PageShell>

        <PageShell>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">NavCard</div>
              <div className="text-sm text-white/55">Entire tile is clickable (used on Home).</div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <NavCard href="/projects" title="Projects" description="Open a project to view Master + channel reports." meta="Example" />
            <NavCard href="/brand/data-entry" title="Planning & Actuals" description="Brand + Sales Ops inputs." meta="Example" />
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

        <PageShell>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white/90">DayDatePicker</div>
              <div className="text-sm text-white/55">Native day-level date selection, styled for our dark glass UI.</div>
            </div>
            <div className="w-full max-w-[340px]">
              <DayDatePicker value={exampleDue} onChange={setExampleDue} showClear />
            </div>
          </div>
        </PageShell>

        <PageShell>
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold text-white/90">PillSelect</div>
            <div className="w-[220px]">
              <PillSelect value="fractional" onChange={() => {}} ariaLabel="Example select">
                <option className="bg-zinc-900" value="fractional">
                  Fractional
                </option>
              </PillSelect>
            </div>
          </div>
        </PageShell>

        <PageShell>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white/90">DropdownMenu</div>
              <div className="text-sm text-white/55">Popover list styling for typeahead + custom menus.</div>
            </div>
            <div className="w-full max-w-[260px]">
              <DropdownMenu title="Mention">
                <DropdownItem>Natasha</DropdownItem>
                <DropdownItem>Sehar</DropdownItem>
                <DropdownItem trailing="CMO">Dayem</DropdownItem>
              </DropdownMenu>
            </div>
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
                  targetPercent: 20,
                  colorClassName: "bg-emerald-400"
                },
                {
                  from: "Qualified",
                  to: "Meeting",
                  percent: (snapshot.meetingsCompleted / Math.max(1, snapshot.qualifiedLeads)) * 100,
                  targetPercent: 10,
                  colorClassName: "bg-fuchsia-400"
                },
                {
                  from: "Meeting",
                  to: "Close",
                  // Design-system demo only (our dummy Snapshot doesn't include dealsWon).
                  percent: 40,
                  targetPercent: 40,
                  colorClassName: "bg-blue-400"
                }
              ]}
            />
          </Surface>
        </div>
      </div>
    </main>
  );
}


