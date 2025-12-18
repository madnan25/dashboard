"use client";

import { Surface } from "@/components/ds/Surface";
import { formatNumber, formatPKRCompact } from "@/lib/format";
import type { PlanChannel, PlanChannelInputs, PlanVersion } from "@/lib/dashboardDb";

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
}) {
  const { activePlanVersion, inputsByChannel } = props;

  return (
    <Surface className="md:col-span-7">
      <div className="text-lg font-semibold text-white/90">Plan allocations (approved)</div>
      <div className="mt-1 text-sm text-white/55">{activePlanVersion ? "Active approved plan is applied." : "No active approved plan for this month yet."}</div>

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
