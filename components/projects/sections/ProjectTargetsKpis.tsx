"use client";

import { KpiCard } from "@/components/ds/KpiCard";
import { formatNumber, formatPKRCompact } from "@/lib/format";
import type { ProjectTargets } from "@/lib/dashboardDb";

export function ProjectTargetsKpis(props: {
  targets: ProjectTargets | null;
  allocatedBudgetTotal: number;
  remainingBudget: number;
}) {
  const { targets, allocatedBudgetTotal, remainingBudget } = props;
  const totalBudgetCap = targets?.total_budget ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <KpiCard label="Sales target (sqft)" value={formatNumber(targets?.sales_target_sqft ?? 0)} />
      <KpiCard label="Avg deal size (sqft)" value={formatNumber(targets?.avg_sqft_per_deal ?? 0)} />
      <KpiCard label="Budget cap" value={formatPKRCompact(totalBudgetCap)} />
      <KpiCard label="Allocated / remaining" value={formatPKRCompact(allocatedBudgetTotal)} helper={`${formatPKRCompact(remainingBudget)} remaining`} />
    </div>
  );
}
