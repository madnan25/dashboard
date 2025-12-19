"use client";

import { KpiCard } from "@/components/ds/KpiCard";
import { formatNumber, formatPKRCompact } from "@/lib/format";

export function SnapshotKpiSummary(props: {
  snapshot: {
    budgetAllocated: number;
    budgetSpent: number;
    leadsGenerated: number;
    qualifiedLeads: number;
    meetingsCompleted: number;
    dealsWon: number;
    sqftWon: number;
    targets: {
      leadsGenerated: number;
      qualifiedLeads: number;
      meetingsScheduled: number;
      meetingsCompleted: number;
      dealsWon: number;
      sqftWon: number;
    };
  };
  budgetUtilizedDisplay: string;
  leadToQualifiedPct: number;
  qualifiedToMeetingPct: number;
}) {
  const { snapshot, budgetUtilizedDisplay } = props;
  const pctOf = (actual: number, target: number) => (target > 0 ? (actual / target) * 100 : 0);

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <KpiCard label="Budget Allocated" value={formatPKRCompact(snapshot.budgetAllocated)} helper="Monthly cap" />
        <KpiCard label="Budget Spent" value={formatPKRCompact(snapshot.budgetSpent)} helper={`${budgetUtilizedDisplay} of allocated`} />
        <KpiCard
          label="Qualified Leads"
          value={formatNumber(snapshot.qualifiedLeads)}
          helper={`Target: ${formatNumber(snapshot.targets.qualifiedLeads)} · ${pctOf(snapshot.qualifiedLeads, snapshot.targets.qualifiedLeads).toFixed(0)}% of target`}
        />
        <KpiCard
          label="Meetings Completed"
          value={formatNumber(snapshot.meetingsCompleted)}
          helper={`Target: ${formatNumber(snapshot.targets.meetingsCompleted)} · ${pctOf(snapshot.meetingsCompleted, snapshot.targets.meetingsCompleted).toFixed(0)}% of target`}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <KpiCard
          label="Deals Won"
          value={formatNumber(snapshot.dealsWon)}
          helper={`Target: ${formatNumber(snapshot.targets.dealsWon)} · ${pctOf(snapshot.dealsWon, snapshot.targets.dealsWon).toFixed(0)}% of target`}
        />
        <KpiCard
          label="Sqft Won"
          value={formatNumber(snapshot.sqftWon)}
          helper={`Target: ${formatNumber(snapshot.targets.sqftWon)} · ${pctOf(snapshot.sqftWon, snapshot.targets.sqftWon).toFixed(0)}% of target`}
        />
      </div>
    </>
  );
}
