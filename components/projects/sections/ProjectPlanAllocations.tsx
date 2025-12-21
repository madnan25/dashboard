"use client";

import { Surface } from "@/components/ds/Surface";
import { DonutChart } from "@/components/charts/DonutChart";
import { formatNumber, formatPKRCompact } from "@/lib/format";
import type { PlanChannel, PlanChannelInputs, PlanVersion, ProjectTargets } from "@/lib/dashboardDb";
import { computeChannelDistributions } from "@/lib/reports/projectHubTargets";

const CHANNELS: PlanChannel[] = ["digital", "inbound", "activations"];

function channelLabel(ch: PlanChannel) {
  switch (ch) {
    case "digital":
      return "Digital";
    case "inbound":
      return "Inbound";
    case "activations":
      return "Activations";
  }
}

export function ProjectPlanAllocations(props: {
  activePlanVersion: PlanVersion | null;
  inputsByChannel: Record<PlanChannel, PlanChannelInputs | null>;
  targets: ProjectTargets | null;
}) {
  const { activePlanVersion, inputsByChannel, targets } = props;

  const dist = computeChannelDistributions(targets, inputsByChannel);
  const channelColors: Record<PlanChannel, string> = {
    digital: "rgba(59,130,246,0.85)",
    inbound: "rgba(16,185,129,0.75)",
    activations: "rgba(124,58,237,0.75)"
  };

  const budgetData = [...CHANNELS]
    .map((ch) => ({
      key: ch,
      label: channelLabel(ch),
      value: dist.budgetByChannel[ch] ?? 0,
      color: channelColors[ch]
    }))
    .sort((a, b) => b.value - a.value);

  const qualifiedData = [...CHANNELS]
    .map((ch) => ({
      key: ch,
      label: `${channelLabel(ch)} (${formatNumber(dist.targetSqftByChannel[ch] ?? 0)} sqft)`,
      value: dist.qualifiedByChannel[ch] ?? 0,
      color: channelColors[ch]
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Surface className="md:col-span-7">
      <div className="text-lg font-semibold text-white/90">Plan allocations (approved)</div>
      <div className="mt-1 text-sm text-white/55">{activePlanVersion ? "Active approved plan is applied." : "No active approved plan for this month yet."}</div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DonutChart
          title="Budget distribution"
          centerLabel="Total"
          centerValue={formatPKRCompact(budgetData.reduce((s, d) => s + (d.value ?? 0), 0))}
          data={budgetData}
        />
        <DonutChart
          title="Qualified leads distribution"
          centerLabel="Total"
          centerValue={formatNumber(qualifiedData.reduce((s, d) => s + (d.value ?? 0), 0))}
          data={qualifiedData}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {CHANNELS.map((ch) => (
          <div key={ch} className="glass-inset rounded-2xl p-4">
            <div className="text-sm font-semibold text-white/85">{channelLabel(ch)}</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between text-white/70">
                <span>Budget</span>
                <span className="font-semibold text-white/90">{formatPKRCompact(inputsByChannel[ch]?.allocated_budget ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-white/70">
                <span>% target</span>
                <span className="font-semibold text-white/90">{inputsByChannel[ch]?.target_contribution_percent ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between text-white/70">
                <span>Target (sqft)</span>
                <span className="font-semibold text-white/90">{formatNumber(dist.targetSqftByChannel[ch] ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-white/70">
                <span>Expected leads</span>
                <span className="font-semibold text-white/90">{formatNumber(inputsByChannel[ch]?.expected_leads ?? 0)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
