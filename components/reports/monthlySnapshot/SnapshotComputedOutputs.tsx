"use client";

import { Button } from "@heroui/react";
import { KpiCard } from "@/components/ds/KpiCard";
import { Surface } from "@/components/ds/Surface";
import { formatNumber, formatPKRCompact } from "@/lib/format";
import type { PlanChannel, PlanChannelInputs, PlanVersion, ProjectTargets } from "@/lib/dashboardDb";

export function SnapshotComputedOutputs(props: {
  channel: PlanChannel;
  targets: ProjectTargets | null;
  channelInputs: PlanChannelInputs | null;
  activePlanVersion: PlanVersion | null;
  computedExpanded: boolean;
  setComputedExpanded: (next: boolean) => void;
  computed: {
    dealsRequired: number;
    channelDealsRequired: number;
    targetLeads: number;
    targetQualifiedLeads: number;
    qualifiedMeetingsRequired: number;
  };
  snapshot: { budgetAllocated: number };
  channelTitle: (channel: PlanChannel) => string;
}) {
  const { channel, targets, channelInputs, activePlanVersion, computedExpanded, setComputedExpanded, computed, snapshot, channelTitle } = props;

  if (!activePlanVersion) {
    return (
      <div className="mt-6">
        <Surface>
          <div className="text-sm text-white/70">No active approved plan version found for this project/month yet.</div>
        </Surface>
      </div>
    );
  }

  return (
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
            onPress={() => setComputedExpanded(!computedExpanded)}
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
  );
}
